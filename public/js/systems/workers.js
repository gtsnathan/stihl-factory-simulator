import { BUILDINGS, ROLES, STATION_STAGES } from '../config.js';
import { accessTile, findPath } from '../core/grid.js';
import { makeWorker } from '../core/state.js';
import { pay } from './economy.js';
import { completeRepair } from './machines.js';
import { dockSpace, depots } from './inventory.js';

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
  const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy), step = ROLES[w.role].speed * dt * (1 - .2 * w.fatigue);
  w.moving = true;
  if (Math.abs(dx) > .01 || Math.abs(dy) > .01) { w.fx = Math.sign(dx); w.fy = Math.sign(dy); }
  if (d <= step) { w.x = tx; w.y = ty; w.path.shift(); } else { w.x += dx / d * step; w.y += dy / d * step; }
  w.fatigue = Math.min(1, w.fatigue + .0006 * dt);
  return false;
}
function moveTo(s, w, x, y, dt) { go(s, w, x, y); if (!w.path.length) w.x = x + .5, w.y = y + .5; return walk(s, w, dt); }
const byId = (s, id) => s.buildings.find((b) => b.id === id);

function rest(s, w, dt) {
  const r = s.buildings.find((b) => b.type === 'rest');
  if (!r) { w.fatigue = Math.max(0, w.fatigue - .012 * dt); if (w.fatigue < .3) w.state = 'idle'; return; }
  const a = accessTile(s, r, w.x, w.y);
  if (a && moveTo(s, w, a.x, a.y, dt)) {
    w.working = false;
    w.fatigue = Math.max(0, w.fatigue - .05 * dt);
    if (w.fatigue < .22) w.state = 'idle';
  }
}

function assembler(s, w, dt) {
  let b = w.job && byId(s, w.job);
  if (!b) {
    w.job = null; w.state = 'idle'; w.working = false;
    b = s.buildings.find((x) => STATION_STAGES[x.type] && !s.workers.some((o) => o.role === 'assembler' && o.job === x.id));
    if (b) w.job = b.id; else return;
  }
  const a = accessTile(s, b, w.x, w.y);
  if (w.state !== 'work') {
    if (a && moveTo(s, w, a.x, a.y, dt)) { w.state = 'work'; b.operatorId = w.id; }
    return;
  }
  b.operatorId = w.id; w.moving = false;
  // Mantém o trabalhador virado para a máquina.
  w.fx = Math.sign(b.x + b.w / 2 - w.x); w.fy = Math.sign(b.y + b.h / 2 - w.y);
  w.working = b.status === 'running';
}

function stockKeeper(s, w, dt) {
  if (w.state === 'idle') {
    let best = null, bestCycles = 3;
    for (const b of s.buildings) {
      const def = STATION_STAGES[b.type];
      if (!def || b.supplyBy) continue;
      let cycles = Infinity, available = false;
      for (const k in def.mats) {
        cycles = Math.min(cycles, (b.buffer[k] || 0) / def.mats[k]);
        if (s.stock[k] > 0 && (b.buffer[k] || 0) < def.mats[k] * 4) available = true;
      }
      if (available && cycles < bestCycles) { bestCycles = cycles; best = b; }
    }
    if (best) { best.supplyBy = w.id; w.job = best.id; w.state = 'toDepot'; }
    else { w.moving = false; return; }
  }
  const b = byId(s, w.job);
  if (w.state === 'toDepot') {
    const dep = depots(s)[0];
    if (!b || !dep) { release(w, b); w.state = 'idle'; return; }
    const a = accessTile(s, dep, w.x, w.y);
    if (a && moveTo(s, w, a.x, a.y, dt)) {
      w.wait += dt;
      if (w.wait > 1) {
        w.wait = 0;
        const def = STATION_STAGES[b.type]; w.carry = {}; let room = 16, qty = 0;
        for (const k in def.mats) {
          const need = Math.max(0, def.mats[k] * 4 - (b.buffer[k] || 0));
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

function technician(sim, w, dt) {
  const s = sim.s;
  if (w.state === 'idle') {
    const list = s.buildings.filter((b) => STATION_STAGES[b.type] && !b.techBy && !b.externalRepair && (b.broken || b.wear > 75));
    if (!list.length) { w.moving = false; return; }
    list.sort((a, b) => (b.broken - a.broken) || b.wear - a.wear);
    list[0].techBy = w.id; w.job = list[0].id; w.state = 'toMachine';
  }
  const b = byId(s, w.job);
  if (!b) { w.state = 'idle'; w.working = false; return; }
  const a = accessTile(s, b, w.x, w.y);
  if (a && moveTo(s, w, a.x, a.y, dt)) {
    if (!b.broken) { b.broken = true; b.techStop = true; }
    w.working = true; w.wait += dt;
    w.fx = Math.sign(b.x + b.w / 2 - w.x); w.fy = Math.sign(b.y + b.h / 2 - w.y);
    if (w.wait > 8) { w.wait = 0; w.working = false; completeRepair(sim, b, 'Técnico interno', 250); w.job = null; w.state = 'idle'; }
  }
}

export function updateWorker(sim, w, dt) {
  const s = sim.s;
  if (w.fatigue >= .92 && w.state !== 'rest' && !w.carryQty && !w.carry) {
    if (w.role === 'assembler') { const b = byId(s, w.job); if (b && b.operatorId === w.id) b.operatorId = null; }
    else if (w.role === 'stock') { const b = byId(s, w.job); release(w, b); }
    else if (w.role === 'fork') { const b = byId(s, w.job); if (b && b.claim === w.id) b.claim = null; w.job = null; }
    else if (w.role === 'tech') return technician(sim, w, dt);
    w.state = 'rest'; w.working = false; w.dest = null;
  }
  if (w.state === 'rest') { rest(s, w, dt); return; }
  if (w.role === 'assembler') assembler(s, w, dt);
  else if (w.role === 'stock') stockKeeper(s, w, dt);
  else if (w.role === 'fork') forklift(s, w, dt);
  else if (w.role === 'tech') technician(sim, w, dt);
}

export function hire(sim, role) {
  const s = sim.s, r = ROLES[role];
  if (s.cash < r.hireCost) return { ok: false, msg: 'Falta dinheiro para contratar.' };
  if (role === 'assembler' && !s.buildings.some((b) => STATION_STAGES[b.type] && !s.workers.some((w) => w.role === 'assembler' && w.job === b.id))) {
    return { ok: false, msg: 'Toda estação já tem montador. Construa outra estação primeiro.' };
  }
  pay(sim, r.hireCost, 'other');
  const w = makeWorker(s, role, 7, 8); s.workers.push(w);
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
export const stationLabel = (b) => BUILDINGS[b.type].name;
