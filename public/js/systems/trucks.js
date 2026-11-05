import { nextId } from '../core/state.js';
import { receive } from './economy.js';

// Caminhões: chegam pela pista, esperam uma doca livre, entram no galpão, operam e vão embora.
export const TRUCK = { road: 9, bay: 3.2, workSeconds: 6, spawnAhead: 26, laneIn: 2.6, laneOut: 4.8 };
const BAY_FOR = { in: 'bayIn', out: 'bayOut' };

export const baysOf = (s, kind) => s.buildings.filter((b) => b.type === BAY_FOR[kind]);
export const truckAtBay = (s, id) => s.trucks.find((t) => t.bay === id) || null;
export const truckQueue = (s) => s.trucks.filter((t) => t.phase === 'approach' && !t.bay).length;

export function requestTruck(s, kind, ref) {
  s.trucks.push({ id: nextId(s), kind, ref, phase: 'approach', bay: null, dir: 'W', x: s.hall.w + TRUCK.spawnAhead, y: s.hall.h + TRUCK.laneIn, t: 0 });
}

function finishWork(sim, k) {
  const s = sim.s;
  if (k.kind !== 'in') return;
  const d = s.deliveries.find((x) => x.id === k.ref);
  if (d) for (const c in d.items) s.stock[c] += d.items[c];
  s.deliveries = s.deliveries.filter((x) => x.id !== k.ref);
  sim.emit('toast', { kind: 'good', text: 'Componentes descarregados no depósito.' });
}
function finishTrip(sim, k) {
  const s = sim.s;
  if (k.kind !== 'out') return;
  const sh = s.shipments.find((x) => x.id === k.ref);
  if (!sh) return;
  receive(sim, sh.value); s.stats.sold += sh.qty;
  s.shipments = s.shipments.filter((x) => x.id !== k.ref);
  sim.emit('toast', { kind: 'good', text: `Recebido R$ ${Math.round(sh.value).toLocaleString('pt-BR')} de ${sh.label}.` });
}

export function updateTrucks(sim, dt) {
  const s = sim.s, W = s.hall.w, H = s.hall.h;
  let waiting = 0;
  for (const k of s.trucks) {
    if (k.phase === 'approach') {
      if (!k.bay) {
        const free = baysOf(s, k.kind).find((b) => !truckAtBay(s, b.id));
        if (free) k.bay = free.id;
      }
      const bay = k.bay && s.buildings.find((b) => b.id === k.bay);
      const target = bay ? bay.x + .5 : W + 1 + waiting++ * 5.2;
      k.x = Math.max(target, k.x - TRUCK.road * dt);
      if (bay && k.x <= target) { k.phase = 'enter'; k.dir = 'N'; k.y = H + TRUCK.laneIn; }
    } else if (k.phase === 'enter') {
      const bay = s.buildings.find((b) => b.id === k.bay);
      k.y = Math.max(bay.y + .3, k.y - TRUCK.bay * dt);
      if (k.y <= bay.y + .3) { k.phase = 'work'; k.t = TRUCK.workSeconds; }
    } else if (k.phase === 'work') {
      k.t -= dt;
      if (k.t <= 0) { finishWork(sim, k); k.phase = 'exit'; }
    } else if (k.phase === 'exit') {
      k.y = Math.min(H + TRUCK.laneIn, k.y + TRUCK.bay * dt);
      if (k.y >= H + TRUCK.laneIn) { k.phase = 'leave'; k.dir = 'E'; k.x -= 3.4; k.y = H + TRUCK.laneOut; k.bay = null; }
    } else {
      k.x += TRUCK.road * dt;
      if (k.x > W + TRUCK.spawnAhead) { finishTrip(sim, k); k.done = true; }
    }
  }
  if (s.trucks.some((k) => k.done)) s.trucks = s.trucks.filter((k) => !k.done);
}
