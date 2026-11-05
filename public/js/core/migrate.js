import { BUILDINGS, COMPONENTS, ZONES } from '../config.js';
import { newGame } from './state.js';
import { requestTruck } from '../systems/trucks.js';

// Saves anteriores aos prédios separados: mantém o progresso e devolve o valor do que foi construído a mais.
export function migrate(s) {
  if (s.zones) {
    if (s.v >= 3) return s;
    return toComplex(s);
  }
  const n = newGame(s.seed);
  for (const k of ['time', 'day', 'hourClock', 'hourIndex', 'speed', 'cash', 'finished', 'stock', 'stats', 'today', 'hourNow', 'hours', 'days', 'objectives', 'research', 'reputation', 'loan', 'orders', 'autoBuy', 'autoShip', 'spot', 'rateHour']) if (s[k] !== undefined) n[k] = s[k];
  n.nextId = Math.max(n.nextId, s.nextId) + 1;
  const base = {};
  for (const b of n.buildings) base[b.type] = (base[b.type] || 0) + 1;
  for (const b of s.buildings) {
    if (b.buffer) for (const k in b.buffer) n.stock[k] = (n.stock[k] || 0) + b.buffer[k];
    if (base[b.type] > 0) base[b.type]--; else n.cash += BUILDINGS[b.type].cost;
  }
  n.cash += Math.max(0, Object.keys(s.belts).length - Object.keys(n.belts).length) * BUILDINGS.belt.cost;
  for (const b of n.buildings) if (b.buffer) b.buffer = {};
  const spots = n.workers.map((w) => ({ x: w.x, y: w.y }));
  n.workers = s.workers.map((w, i) => ({ ...w, ...(spots[i] || { x: 7.5, y: 8.5 }), path: [], state: 'idle', job: null, carry: null, carryQty: 0, dest: null, working: false, moving: false }));
  n.finished += s.workers.reduce((a, w) => a + (w.role === 'fork' ? w.carryQty || 0 : 0), 0);
  n.deliveries = s.deliveries.map((d) => ({ ...d, t: Math.min(d.t, 8), truck: false }));
  n.shipments = s.shipments.map((x) => ({ id: x.id, label: x.label, qty: x.qty, value: x.value }));
  n.trucks = [];
  for (const x of n.shipments) requestTruck(n, 'out', x.id);
  return n;
}

// Versão com três prédios: empurra tudo para as fileiras da frente, sem mexer em nada que o jogador construiu.
function toComplex(s) {
  const O = 18;
  for (const z of s.zones) {
    z.y += O; z.doors.forEach((d) => { d.y += O; });
    const base = ZONES.find((b) => b.id === z.id);
    if (base) { z.name = base.name; z.sector = base.sector; z.wall = 56; }
  }
  for (const b of s.buildings) b.y += O;
  const belts = {};
  for (const k in s.belts) { const c = s.belts[k]; c.y += O; belts[`${c.x},${c.y}`] = c; }
  s.belts = belts;
  for (const w of s.workers) { w.y += O; w.path = []; w.dest = null; w.gv = -1; }
  for (const k of s.trucks || []) k.y += O;
  s.hall.h += O;
  for (const k in COMPONENTS) if (s.stock[k] === undefined) s.stock[k] = 0;
  s.v = 3; s.gridVer++;
  return s;
}
