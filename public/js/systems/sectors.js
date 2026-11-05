import { BUILDINGS, DEPARTMENTS, GAME, LOTS, MACHINES, SECTORS } from '../config.js';
import { canPlace } from '../core/grid.js';
import { makeBuilding, nextId, rng } from '../core/state.js';
import { pay } from './economy.js';

// ---------- Efeitos dos departamentos: só valem com alguém trabalhando na mesa ----------
export const deptActive = (s, id) => s.buildings.some((b) => b.type === 'desk' && b.dept === id && b.status === 'running');
export function computeEffects(s) {
  const on = (id) => deptActive(s, id);
  return {
    cycle: on('engprod') ? .95 : 1,
    machineCycle: on('ferram') ? .92 : 1,
    wear: on('ferram') ? .85 : 1,
    defect: (on('engproc') ? .75 : 1) * (on('qualidade') ? .8 : 1),
    rework: on('qualidade') ? .85 : .6,
    repair: on('manut') ? .7 : 1,
    incident: on('ti') ? .5 : 1,
    price: on('compras') ? .94 : 1,
    delivery: on('compras') ? .6 : 1,
    hire: on('rh') ? .5 : 1,
    fatigue: on('rh') ? .8 : 1,
    haul: on('logint') ? 1.25 : 1,
    research: on('ped') ? 1.6 : 1,
    pcp: on('pcp'),
    safety: on('seg'),
  };
}

// ---------- Compra de prédios ----------
const overlaps = (s, L) => s.zones.some((z) => L.x < z.x + z.w + 2 && z.x < L.x + L.w + 2 && L.y < z.y + z.h + 2 && z.y < L.y + L.h + 2);
export const freeLots = (s) => LOTS.filter((L) => !overlaps(s, L));

export function buyBuilding(sim, sector) {
  const s = sim.s, def = SECTORS[sector];
  if (!def) return { ok: false };
  if (s.cash < def.cost) return { ok: false, msg: 'Falta dinheiro para este prédio.' };
  const L = freeLots(s)[0];
  if (!L) return { ok: false, msg: 'Não há mais terrenos livres no complexo.' };
  pay(sim, def.cost, 'build');
  const same = s.zones.filter((z) => (z.sector || z.id) === sector).length;
  const id = `z${nextId(s)}`;
  const name = `Prédio ${String(def.num).padStart(2, '0')}${same ? `-${same + 1}` : ''} · ${def.name}`;
  const door = L.y === 0 ? { x: L.x + 5, y: L.y + L.h - 1 } : { x: L.x + 5, y: L.y };
  const z = { id, sector, name, x: L.x, y: L.y, w: L.w, h: L.h, wall: 56, tint: def.tint, doors: [door] };
  s.zones.push(z);
  s.hall.w = Math.max(s.hall.w, L.x + L.w);
  if (DEPARTMENTS[sector]) {
    const dy = L.y === 0 ? 1 : 3;
    const b = makeBuilding(s, 'desk', L.x + 4, L.y + dy); b.dept = sector; s.buildings.push(b);
  }
  s.gridVer++;
  sim.emit('hall', {});
  return { ok: true, msg: `${name} construído.`, zone: z };
}

// ---------- Máquinas com receita ----------
export const STOCK_TARGET = 40;
export const machineDef = (b) => MACHINES[b.type];
export const moldOutput = (b) => (b.type === 'injetora' ? b.mold || 'carcaca' : MACHINES[b.type].out);
export function setMold(b) { b.mold = b.mold === 'tampa' ? 'carcaca' : 'tampa'; b.progress = 0; }

const zoneOf = (s, b) => s.zones.find((z) => b.x >= z.x && b.y >= z.y && b.x < z.x + z.w && b.y < z.y + z.h);

export function machineCycle(sim, b) {
  const fx = sim.fx, base = MACHINES[b.type].cycle;
  return base * fx.cycle * fx.machineCycle * (sim.s.research.done.pneumatic ? .85 : 1);
}

export function updateMachine(sim, b, dt) {
  const s = sim.s, def = MACHINES[b.type];
  if (b.broken) {
    b.t.broken += dt; b.status = 'broken';
    if (b.externalRepair) { b.repairT -= dt; if (b.repairT <= 0) sim.completeRepair(b, 'Reparo terceirizado', 1800); }
    return;
  }
  const op = def.role === 'none' ? null : s.workers.find((w) => w.id === b.operatorId && w.state === 'work');
  if (def.role !== 'none' && !op) {
    if (def.heat) b.temp = Math.max(25, (b.temp ?? 25) - 4 * dt);
    if (def.desk) { b.status = 'no_operator'; return; }
    b.t.absent += dt; b.status = 'no_operator'; return;
  }
  const prod = op ? sim.productivity(op) : 1;
  if (op) { op.xp += dt; op.fatigue = Math.min(1, op.fatigue + .0025 * sim.fx.fatigue * dt); }
  if (def.desk) { b.status = 'running'; return; }

  if (def.heat) { // forno: aquece até a faixa de trabalho e oscila
    const target = 690 + Math.sin(s.time / 30 + b.id) * 25;
    b.temp = (b.temp ?? 25) + Math.sign(target - (b.temp ?? 25)) * Math.min(Math.abs(target - (b.temp ?? 25)), 22 * dt);
    b.status = 'running'; b.t.run += dt; b.hours += dt / GAME.hourSeconds; wear(sim, b, dt);
    return;
  }
  const zone = zoneOf(s, b);
  if (def.treat) {
    if (!zone || (zone.waste || 0) <= 0) { b.status = 'starved_wip'; b.t.starved += dt; return; }
    zone.waste = Math.max(0, zone.waste - 2.2 * dt * prod);
    b.status = 'running'; b.t.run += dt; b.hours += dt / GAME.hourSeconds; wear(sim, b, dt);
    return;
  }
  if (!b.busy) {
    if (b.out >= def.outCap) { b.t.blocked += dt; b.status = 'blocked'; return; }
    // Produção puxada: com o estoque da peça cheio, a máquina espera em vez de lotar o depósito.
    if (def.out && (s.stock[moldOutput(b)] || 0) >= STOCK_TARGET) { b.t.blocked += dt; b.status = 'stock_full'; return; }
    if (def.needsHeat) {
      const hot = s.buildings.some((f) => MACHINES[f.type]?.heat && zoneOf(s, f) === zone && (f.temp ?? 0) >= 600);
      if (!hot) { b.t.starved += dt; b.status = 'cold'; return; }
    }
    if (def.waste && zone && (zone.waste || 0) >= 100) { b.t.blocked += dt; b.status = 'waste_full'; return; }
    for (const k in def.in) if ((b.buffer[k] || 0) < def.in[k]) { b.t.starved += dt; b.status = 'starved_mat'; return; }
    for (const k in def.in) b.buffer[k] -= def.in[k];
    b.busy = true; b.progress = 0;
  }
  b.status = 'running'; b.t.run += dt; b.hours += dt / GAME.hourSeconds;
  b.progress += dt / machineCycle(sim, b) * prod;
  if (wear(sim, b, dt)) return;
  if (b.progress >= 1) {
    b.busy = false; b.progress = 0; b.done++;
    if (def.waste && zone) zone.waste = Math.min(100, (zone.waste || 0) + def.waste);
    let chance = (def.defect || 0) * sim.fx.defect * (1 + b.wear / 100);
    if (def.needsHeat) { // temperatura fora da faixa piora a peça
      const f = s.buildings.find((x) => MACHINES[x.type]?.heat && zoneOf(s, x) === zone);
      if (f && Math.abs((f.temp ?? 0) - 690) > 20) chance *= 1.6;
    }
    if (rng(s) < chance) { b.bad++; s.stats.scrapped++; s.today.scrapped++; sim.sectorScrap = true; return; }
    b.good++; b.out++;
    s.stats.made = (s.stats.made || 0) + 1;
  }
}

function wear(sim, b, dt) {
  const s = sim.s;
  b.wear = Math.min(100, b.wear + .09 * sim.fx.wear * (s.research.done.lube ? .7 : 1) * dt);
  if ((b.wear > 50 && rng(s) < ((b.wear - 50) / 50) ** 2 * .01 * dt) || b.wear >= 100) {
    b.broken = true; b.externalRepair = false; b.status = 'broken';
    b.fault = { kind: 'maint', text: `${BUILDINGS[b.type].name} parada por desgaste`, at: s.time };
    sim.emit('toast', { kind: 'bad', text: `Chamado aberto: ${b.fault.text}.` });
    sim.emit('breakdown', { id: b.id });
    return true;
  }
  return false;
}

// ---------- Chamados técnicos ----------
const INCIDENTS = [
  { kind: 'it', text: 'Impressora Zebra sem imprimir', types: ['label', 'st3'] },
  { kind: 'it', text: 'Impressora Lexmark sem toner', types: ['label', 'desk'] },
  { kind: 'it', text: 'Computador industrial sem rede', types: ['cnc', 'robot', 'st1', 'st2'] },
  { kind: 'it', text: 'Coletor de dados desconectado', types: ['st3', 'label', 'bancada'] },
  { kind: 'maint', text: 'Máquina CNC parada', types: ['cnc'] },
  { kind: 'maint', text: 'Sensor industrial com defeito', types: ['st1', 'st2', 'st3', 'injetora', 'diecast', 'tanque'] },
  { kind: 'maint', text: 'Esteira transportadora travada', belt: true },
];

export function updateIncidents(sim, dt) {
  const s = sim.s;
  s.incidentT = (s.incidentT ?? GAME.hourSeconds) - dt;
  if (s.incidentT > 0) return;
  s.incidentT = GAME.hourSeconds;
  if (s.day < 2) return;
  if (rng(s) < .3 * sim.fx.incident) raiseIncident(sim);
  const machines = s.buildings.filter((b) => b.t).length;
  if (machines >= 6 && !sim.fx.safety && rng(s) < .05) {
    const v = s.buildings.filter((b) => b.t && !b.broken && b.type !== 'desk');
    const b = v[Math.floor(rng(s) * v.length)];
    if (b) {
      b.broken = true; b.fault = { kind: 'maint', text: 'Acidente de trabalho: área interditada', at: s.time };
      pay(sim, 4000, 'other');
      sim.emit('toast', { kind: 'bad', text: `Acidente em ${BUILDINGS[b.type].name}: multa de R$ 4.000. Segurança do Trabalho evita isso.` });
    }
  }
}

export function raiseIncident(sim, forced) {
  const s = sim.s;
  const pick = forced || INCIDENTS[Math.floor(rng(s) * INCIDENTS.length)];
  if (pick.belt) {
    const list = Object.values(s.belts).filter((c) => !c.jam);
    if (!list.length) return null;
    const c = list[Math.floor(rng(s) * list.length)];
    c.jam = { text: pick.text, at: s.time, kind: 'maint' };
    sim.emit('toast', { kind: 'bad', text: `Chamado aberto: ${pick.text}.` });
    return c;
  }
  const list = s.buildings.filter((b) => pick.types.includes(b.type) && !b.broken);
  if (!list.length) return null;
  const b = list[Math.floor(rng(s) * list.length)];
  b.broken = true; b.externalRepair = false;
  b.fault = { kind: pick.kind, text: pick.text, at: s.time };
  sim.emit('toast', { kind: 'bad', text: `Chamado aberto: ${pick.text}.` });
  return b;
}

export function callBeltService(sim, key) {
  const c = sim.s.belts[key];
  if (!c || !c.jam || c.jamT > 0) return { ok: false, msg: 'O serviço já está a caminho.' };
  if (sim.s.cash < 600) return { ok: false, msg: 'Falta dinheiro para o serviço.' };
  pay(sim, 600, 'maint'); c.jamT = 15;
  return { ok: true, msg: 'Serviço externo libera a esteira em 15 s.' };
}

export function openTickets(s) {
  const out = [];
  for (const b of s.buildings) if (b.broken && !b.preventive && !b.techStop) out.push({ type: 'b', id: b.id, place: BUILDINGS[b.type].name, text: b.fault?.text || 'Máquina quebrada', kind: b.fault?.kind || 'maint', age: s.time - (b.fault?.at ?? s.time), ext: b.externalRepair, tech: b.techBy, repairT: b.repairT });
  for (const k in s.belts) { const c = s.belts[k]; if (c.jam) out.push({ type: 'c', id: k, place: `Esteira ${c.x}, ${c.y}`, text: c.jam.text, kind: 'maint', age: s.time - c.jam.at, ext: c.jamT > 0, tech: c.techBy, repairT: c.jamT }); }
  return out;
}

export function sectorEfficiency(s) {
  return s.zones.map((z) => {
    const ms = s.buildings.filter((b) => b.t && b.type !== 'desk' && zoneOf(s, b) === z);
    let run = 0, tot = 0, good = 0, bad = 0, stopped = 0;
    for (const b of ms) { const t = b.t; run += t.run; tot += t.run + t.starved + t.blocked + t.broken + t.absent; good += b.good; bad += b.bad; if (b.broken) stopped++; }
    return { z, count: ms.length, eff: tot > 0 ? run / tot : 0, good, bad, stopped };
  }).filter((x) => x.count);
}

export const placeInZone = (s, type, z) => { // usado por testes e pelo modo "instalar"
  const d = BUILDINGS[type];
  for (let y = z.y + 1; y + d.h <= z.y + z.h - 1; y++) for (let x = z.x + 1; x + d.w <= z.x + z.w - 1; x++) {
    if (canPlace(s, x, y, d.w, d.h) && !z.doors.some((o) => o.x >= x && o.x < x + d.w && o.y >= y - 1 && o.y <= y + d.h)) return { x, y };
  }
  return null;
};
