import { BUILDINGS, MACHINES, ROLES, STATION_STAGES } from '../config.js';
import { accessTile, findPath } from '../core/grid.js';
import { makeWorker } from '../core/state.js';
import { pay } from './economy.js';
import { completeRepair } from './machines.js';
import { dockSpace, depots, stockUsed, depotCapacity } from './inventory.js';
import { computeEffects, deptActive } from './sectors.js';

export function workerProductivity(w) {
  return (w.base + w.train * .06 + Math.min(.2, w.xp / 3600 * .2)) * (1 - .35 * w.fatigue);
}

function go(s, w, x, y) { // devolve true quando chegou
  const dest = w.dest;
  if (!dest || dest.x !== x || dest.y !== y || w.gv !== s.gridVer) {
    w.dest = { x, y }; w.gv = s.gridVer;
    w.path = findPath(s, Math.floor(w.x), Math.floor(w.y), x, y) || [];
  }
  return false;
}
function walk(s, w, dt) {
  w.moving = false;
  if (!w.path.length) return Math.hypot(w.x - (w.dest?.x + .5), w.y - (w.dest?.y + .5)) < .08;
  const t = w.path[0], tx = t.x + .5, ty = t.y + .5;
  const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy), step = ROLES[w.role].speed * dt * (1 - .2 * w.fatigue) * (w.role === 'stock' || w.role === 'fork' ? s.haulFx || 1 : 1);
  w.moving = true;
  if (Math.abs(dx) > .01 || Math.abs(dy) > .01) { w.fx = Math.sign(dx); w.fy = Math.sign(dy); }
  if (d <= step) { w.x = tx; w.y = ty; w.path.shift(); } else { w.x += dx / d * step; w.y += dy / d * step; }
  w.fatigue = Math.min(1, w.fatigue + .0006 * dt);
  return false;
}
function moveTo(s, w, x, y, dt) { go(s, w, x, y); if (!w.path.length) w.x = x + .5, w.y = y + .5; return walk(s, w, dt); }
const byId = (s, id) => s.buildings.find((b) => b.id === id);

// Descansa na área mais próxima. Longe de qualquer área, faz a pausa no posto e recupera mais devagar.
function rest(s, w, dt) {
  let r = null, best = 16;
  for (const b of s.buildings) if (b.type === 'rest') { const d = Math.abs(b.x - w.x) + Math.abs(b.y - w.y); if (d < best) { best = d; r = b; } }
  if (w.dest && w.restAt && !r) r = s.buildings.find((b) => b.id === w.restAt) || null;
  if (!r) { w.moving = false; w.working = false; w.fatigue = Math.max(0, w.fatigue - .025 * dt); if (w.fatigue < .22) w.state = 'idle'; return; }
  w.restAt = r.id;
  const a = accessTile(s, r, w.x, w.y);
  if (a && moveTo(s, w, a.x, a.y, dt)) {
    w.working = false;
    w.fatigue = Math.max(0, w.fatigue - .05 * dt);
    if (w.fatigue < .22) { w.state = 'idle'; w.restAt = null; }
  }
}

const needsRole = (b, role) => (STATION_STAGES[b.type] ? role === 'assembler' : MACHINES[b.type]?.role === role);
function assembler(s, w, dt) {
  let b = w.job && byId(s, w.job);
  if (!b) {
    w.job = null; w.state = 'idle'; w.working = false; w.moving = false;
    if ((w.seek = (w.seek || 0) - dt) > 0) return;
    w.seek = 1;
    b = s.buildings.find((x) => needsRole(x, w.role) && !s.workers.some((o) => o.job === x.id && o.role === w.role));
    if (b) w.job = b.id; else return;
  }
  if (w.state !== 'work') {
    const a = accessTile(s, b, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) { w.state = 'work'; b.operatorId = w.id; }
    return;
  }
  b.operatorId = w.id; w.moving = false;
  // Mantém o trabalhador virado para a máquina.
  w.fx = Math.sign(b.x + b.w / 2 - w.x); w.fy = Math.sign(b.y + b.h / 2 - w.y);
  w.working = b.status === 'running';
}

const matsOf = (b) => STATION_STAGES[b.type]?.mats || MACHINES[b.type]?.in || null;

// Carrinho de abastecimento: leva material às máquinas e busca o que elas produziram.
function stockKeeper(s, w, dt) {
  if (w.state === 'idle') {
    w.moving = false;
    if ((w.seek = (w.seek || 0) - dt) > 0) return;
    w.seek = .5;
    let best = null, bestCycles = 3, collect = null, collectN = 1;
    const room = stockUsed(s) < depotCapacity(s);
    for (const b of s.buildings) {
      if (!b.t || b.supplyBy) continue;
      if (room && b.out > collectN) { collectN = b.out; collect = b; }
      const mats = matsOf(b);
      if (!mats || b.broken) continue;
      let cycles = Infinity, available = false;
      for (const k in mats) {
        cycles = Math.min(cycles, (b.buffer[k] || 0) / mats[k]);
        if (s.stock[k] > 0 && (b.buffer[k] || 0) < mats[k] * 4) available = true;
      }
      if (available && cycles < bestCycles) { bestCycles = cycles; best = b; }
    }
    if (collect && (collectN >= 4 || !best)) { collect.supplyBy = w.id; w.job = collect.id; w.state = 'toOutput'; }
    else if (best) { best.supplyBy = w.id; w.job = best.id; w.state = 'toDepot'; }
    else return;
  }
  const b = byId(s, w.job), dep = depots(s)[0];
  if (w.state === 'toDepot') {
    if (!b || !dep) { release(w, b); w.state = 'idle'; return; }
    const a = accessTile(s, dep, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) {
      w.wait += dt;
      if (w.wait > 1) {
        w.wait = 0;
        const mats = matsOf(b); w.carry = {}; let room = 40, qty = 0;
        for (const k in mats) {
          const need = Math.max(0, mats[k] * (MACHINES[b.type] ? 8 : 4) - (b.buffer[k] || 0));
          const q = Math.min(need, s.stock[k], room);
          if (q > 0) { w.carry[k] = q; s.stock[k] -= q; room -= q; qty += q; }
        }
        w.carryQty = qty;
        w.state = qty ? 'toStation' : 'idle';
        if (!qty) release(w, b);
      }
    }
  } else if (w.state === 'toStation') {
    if (!b) { returnCarry(s, w); w.state = 'idle'; return; }
    const a = accessTile(s, b, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) {
      w.wait += dt;
      if (w.wait > .7) {
        w.wait = 0;
        for (const k in w.carry) b.buffer[k] = (b.buffer[k] || 0) + w.carry[k];
        w.carry = null; w.carryQty = 0; release(w, b); w.state = 'idle';
      }
    }
  } else if (w.state === 'toOutput') {
    if (!b) { w.job = null; w.state = 'idle'; return; }
    const a = accessTile(s, b, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) {
      w.wait += dt;
      if (w.wait > .7) {
        w.wait = 0;
        const q = Math.min(40, b.out), item = b.type === 'injetora' ? b.mold || 'carcaca' : MACHINES[b.type].out;
        b.out -= q; w.carry = { [item]: q }; w.carryQty = q; release(w, b); w.state = 'toDrop';
      }
    }
  } else if (w.state === 'toDrop') {
    if (!dep) return;
    const a = accessTile(s, dep, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) {
      w.wait += dt;
      if (w.wait > .7) { w.wait = 0; returnCarry(s, w); w.state = 'idle'; }
    }
  }
}
function release(w, b) { if (b && b.supplyBy === w.id) b.supplyBy = null; w.job = null; }
function returnCarry(s, w) { if (w.carry) for (const k in w.carry) s.stock[k] += w.carry[k]; w.carry = null; w.carryQty = 0; }

function forklift(s, w, dt) {
  if (w.state === 'idle') {
    const p = s.buildings.find((b) => b.type === 'pallet' && b.count > 0 && !b.claim);
    if (p && s.buildings.some((b) => b.type === 'dock')) { p.claim = w.id; w.job = p.id; w.state = 'toPallet'; }
    else { w.moving = false; return; }
  }
  if (w.state === 'toPallet') {
    const p = byId(s, w.job);
    if (!p) { w.state = 'idle'; return; }
    const a = accessTile(s, p, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) {
      w.wait += dt;
      if (w.wait > .8) { w.wait = 0; const q = Math.min(4, p.count); p.count -= q; w.carryQty = q; p.claim = null; w.state = 'toDock'; }
    }
  } else if (w.state === 'toDock') {
    const d = s.buildings.find((b) => b.type === 'dock');
    if (!d) { return; }
    const a = accessTile(s, d, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt) && dockSpace(s) >= w.carryQty) {
      w.wait += dt;
      if (w.wait > .8) { w.wait = 0; s.finished += w.carryQty; w.carryQty = 0; w.state = 'idle'; }
    }
  }
}

// Técnico atende chamados da sua área: vai ao local, diagnostica e repara.
function technician(sim, w, dt) {
  const s = sim.s, kind = w.role === 'it' ? 'it' : 'maint';
  if (w.state === 'idle') {
    w.moving = false; w.working = false;
    if ((w.seek = (w.seek || 0) - dt) > 0) return;
    w.seek = .5;
    const list = s.buildings.filter((b) => b.t && !b.techBy && !b.externalRepair && (b.broken ? (b.fault?.kind || 'maint') === kind : kind === 'maint' && b.wear > 75));
    if (list.length) {
      list.sort((a, b) => (b.broken - a.broken) || b.wear - a.wear);
      list[0].techBy = w.id; w.job = list[0].id; w.belt = null; w.state = 'toMachine';
    } else if (kind === 'maint') {
      const c = Object.values(s.belts).find((x) => x.jam && !x.techBy && !(x.jamT > 0));
      if (!c) return;
      c.techBy = w.id; w.belt = `${c.x},${c.y}`; w.job = null; w.state = 'toMachine';
    } else return;
  }
  const time = 8 * sim.fx.repair, diag = 3;
  if (w.belt) {
    const c = s.belts[w.belt];
    if (!c || !c.jam) { if (c) c.techBy = null; w.belt = null; w.state = 'idle'; w.wait = 0; return; }
    if (moveTo(s, w, c.x, c.y, dt)) {
      w.working = true; w.wait += dt; w.diag = w.wait < diag;
      if (w.wait > diag + time * .6) { w.wait = 0; w.working = false; c.jam = null; c.techBy = null; w.belt = null; w.state = 'idle'; sim.emit('toast', { kind: 'good', text: 'Esteira liberada.' }); }
    }
    return;
  }
  const b = byId(s, w.job);
  if (!b) { w.state = 'idle'; w.working = false; return; }
  const a = accessTile(s, b, w.x, w.y);
  if (a && moveTo(s, w, a.x, a.y, dt)) {
    if (!b.broken) { b.broken = true; b.techStop = true; }
    w.working = true; w.wait += dt; w.diag = w.wait < diag;
    w.fx = Math.sign(b.x + b.w / 2 - w.x); w.fy = Math.sign(b.y + b.h / 2 - w.y);
    if (w.wait > diag + time) { w.wait = 0; w.working = false; completeRepair(sim, b, kind === 'it' ? 'Técnico de TI' : 'Técnico interno', 250); w.job = null; w.state = 'idle'; }
  }
}

export function updateWorker(sim, w, dt) {
  const s = sim.s;
  if (w.fatigue >= .92 && w.state !== 'rest' && !w.carryQty && !w.carry) {
    if (w.role === 'assembler' || w.role === 'office') { const b = byId(s, w.job); if (b && b.operatorId === w.id) b.operatorId = null; }
    else if (w.role === 'stock') { const b = byId(s, w.job); release(w, b); }
    else if (w.role === 'fork') { const b = byId(s, w.job); if (b && b.claim === w.id) b.claim = null; w.job = null; }
    else if (w.role === 'tech' || w.role === 'it') return technician(sim, w, dt);
    w.state = 'rest'; w.working = false; w.dest = null;
  }
  if (w.state === 'rest') { rest(s, w, dt); return; }
  if (w.role === 'assembler' || w.role === 'office') assembler(s, w, dt);
  else if (w.role === 'stock') stockKeeper(s, w, dt);
  else if (w.role === 'fork') forklift(s, w, dt);
  else technician(sim, w, dt);
}

export function hire(sim, role) {
  const s = sim.s, r = ROLES[role];
  const cost = Math.round(r.hireCost * sim.fx.hire);
  if (s.cash < cost) return { ok: false, msg: 'Falta dinheiro para contratar.' };
  if (r.needs && !deptActive(s, r.needs)) return { ok: false, msg: 'Construa o prédio de TI e contrate um analista para ele antes.' };
  if ((role === 'assembler' || role === 'office') && !s.buildings.some((b) => needsRole(b, role) && !s.workers.some((w) => w.role === role && w.job === b.id))) {
    return { ok: false, msg: role === 'office' ? 'Todo departamento já tem analista. Construa outro em Complexo.' : 'Toda máquina já tem operador. Construa outra primeiro.' };
  }
  pay(sim, cost, 'other');
  const w = makeWorker(s, role, 7, 26); s.workers.push(w);
  return { ok: true, msg: `${w.name} foi contratado(a).` };
}
export function fire(sim, id) {
  const s = sim.s, w = s.workers.find((x) => x.id === id);
  if (!w) return { ok: false };
  if (w.carry) returnCarry(s, w);
  if (w.carryQty && w.role === 'fork') s.finished += w.carryQty;
  for (const b of s.buildings) {
    if (b.operatorId === id) b.operatorId = null;
    if (b.supplyBy === id) b.supplyBy = null;
    if (b.techBy === id) { b.techBy = null; if (b.techStop) { b.broken = false; b.techStop = false; } }
    if (b.claim === id) b.claim = null;
  }
  s.workers = s.workers.filter((x) => x.id !== id);
  return { ok: true, msg: `${w.name} foi desligado(a).` };
}
export function train(sim, id) {
  const w = sim.s.workers.find((x) => x.id === id);
  if (!w) return { ok: false };
  if (w.train >= 5) return { ok: false, msg: 'Treinamento já está no nível máximo.' };
  const cost = trainCost(w);
  if (sim.s.cash < cost) return { ok: false, msg: 'Falta dinheiro para o treinamento.' };
  pay(sim, cost, 'other');
  w.train++; w.salary = Math.round(w.salary * 1.05);
  return { ok: true, msg: `${w.name} chegou ao nível ${w.train} de treinamento.` };
}
export const trainCost = (w) => 2500 * (w.train + 1);
export { computeEffects };
export const stationLabel = (b) => BUILDINGS[b.type].name;
