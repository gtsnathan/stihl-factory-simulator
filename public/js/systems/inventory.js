import { BUILDINGS, COMPONENTS, GAME, MACHINES, STATION_STAGES } from '../config.js';
import { nextId } from '../core/state.js';
import { pay } from './economy.js';
import { requestTruck } from './trucks.js';

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
  for (const k in items) { cost += Math.round(COMPONENTS[k].price * items[k] * sim.fx.price); qty += items[k]; }
  if (qty <= 0) return { ok: false, msg: 'Escolha uma quantidade.' };
  if (!depots(s).length) return { ok: false, msg: 'Construa um depósito antes de comprar.' };
  if (stockUsed(s) + incoming(s) + qty > depotCapacity(s)) return { ok: false, msg: 'O depósito não tem espaço para esta compra.' };
  if (s.cash < cost) return { ok: false, msg: 'Falta dinheiro para esta compra.' };
  pay(sim, cost, 'parts');
  s.deliveries.push({ id: nextId(s), items, t: GAME.deliverySeconds * sim.fx.delivery, truck: false });
  return { ok: true, msg: `Compra feita por R$ ${cost.toLocaleString('pt-BR')}. O caminhão chega em instantes.` };
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
    if (!d.truck && d.t <= 0) { d.truck = true; requestTruck(s, 'in', d.id); }
  }

  s.warnStock -= dt;
  // PCP: repõe matéria-prima dos setores instalados
  if (s.autoRaw && sim.fx.pcp && !s.deliveries.some((d) => d.raw)) {
    const need = {};
    for (const b of s.buildings) { const m = MACHINES[b.type]?.in; if (m) for (const k in m) if (COMPONENTS[k].raw && s.stock[k] < 15) need[k] = 40; }
    if (Object.keys(need).length && buy(sim, need).ok) s.deliveries[s.deliveries.length - 1].raw = true;
  }
  // O que a fábrica já produz não entra na compra automática nem no aviso de falta.
  const own = new Set(s.buildings.flatMap((b) => { const m = MACHINES[b.type]; return !m?.out ? [] : b.type === 'injetora' ? [b.mold || 'carcaca'] : [m.out]; }));
  const kit = kitFor(1);
  const low = Object.keys(kit).find((k) => !own.has(k) && s.stock[k] < kit[k] * 3);
  if (s.autoBuy && !s.deliveries.some((d) => !d.raw) && low) {
    const items = kitFor(s.autoBuyTarget);
    for (const k of own) delete items[k];
    const res = buy(sim, items);
    if (!res.ok && s.warnStock <= 0) { s.warnStock = 45; sim.emit('toast', { kind: 'warn', text: `Compra automática parada: ${res.msg}` }); }
  } else if (low && !s.deliveries.length && s.warnStock <= 0) {
    s.warnStock = 45;
    sim.emit('toast', { kind: 'warn', text: `${COMPONENTS[low].name} está acabando. Abra Estoque e compre mais.` });
  }
}
