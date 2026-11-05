import { BUILDINGS, COMPONENTS, GAME, STATION_STAGES } from '../config.js';
import { nextId } from '../core/state.js';
import { pay } from './economy.js';

export const depots = (s) => s.buildings.filter((b) => b.type === 'depot');
export const docks = (s) => s.buildings.filter((b) => b.type === 'dock');
export const depotCapacity = (s) => depots(s).length * BUILDINGS.depot.cap;
export const dockCapacity = (s) => docks(s).length * BUILDINGS.dock.cap;
export const dockSpace = (s) => dockCapacity(s) - s.finished;
export const stockUsed = (s) => Object.values(s.stock).reduce((a, b) => a + b, 0);
export const incoming = (s) => s.deliveries.reduce((sum, d) => sum + Object.values(d.items).reduce((a, b) => a + b, 0), 0);

export function buy(sim, items) {
  const s = sim.s;
  let cost = GAME.freightIn, qty = 0;
  for (const k in items) { cost += COMPONENTS[k].price * items[k]; qty += items[k]; }
  if (qty <= 0) return { ok: false, msg: 'Escolha uma quantidade.' };
  if (!depots(s).length) return { ok: false, msg: 'Construa um depósito antes de comprar.' };
  if (stockUsed(s) + incoming(s) + qty > depotCapacity(s)) return { ok: false, msg: 'O depósito não tem espaço para esta compra.' };
  if (s.cash < cost) return { ok: false, msg: 'Falta dinheiro para esta compra.' };
  pay(sim, cost, 'parts');
  s.deliveries.push({ id: nextId(s), items, t: GAME.deliverySeconds, truck: false });
  return { ok: true, msg: `Compra feita por R$ ${cost.toLocaleString('pt-BR')}. Entrega em ${GAME.deliverySeconds} s.` };
}

// Conjunto de componentes para fabricar N motosserras.
export function kitFor(n) {
  const items = {};
  for (const k in STATION_STAGES) for (const m in STATION_STAGES[k].mats) items[m] = (items[m] || 0) + STATION_STAGES[k].mats[m] * n;
  return items;
}

export function updateInventory(sim, dt) {
  const s = sim.s;
  for (const d of s.deliveries) {
    d.t -= dt;
    if (!d.truck && d.t <= 7) { d.truck = true; sim.emit('truck', { kind: 'in' }); }
    if (d.t <= 0) {
      for (const k in d.items) s.stock[k] += d.items[k];
      sim.emit('toast', { kind: 'good', text: 'Componentes recebidos no depósito.' });
    }
  }
  s.deliveries = s.deliveries.filter((d) => d.t > 0);

  s.warnStock -= dt;
  const kit = kitFor(1);
  const low = Object.keys(kit).find((k) => s.stock[k] < kit[k] * 3);
  if (s.autoBuy && !s.deliveries.length && low) {
    const res = buy(sim, kitFor(s.autoBuyTarget));
    if (!res.ok && s.warnStock <= 0) { s.warnStock = 45; sim.emit('toast', { kind: 'warn', text: `Compra automática parada: ${res.msg}` }); }
  } else if (low && !s.deliveries.length && s.warnStock <= 0) {
    s.warnStock = 45;
    sim.emit('toast', { kind: 'warn', text: `${COMPONENTS[low].name} está acabando. Abra Estoque e compre mais.` });
  }
}
