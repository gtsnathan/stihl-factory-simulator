import { CLIENTS, GAME, MODELS } from '../config.js';
import { nextId, rng, blankDay, blankHour } from '../core/state.js';
import { computeEfficiency } from './production.js';
import { stationPower, isStation } from './machines.js';

export function pay(sim, value, cat) {
  const s = sim.s;
  s.cash -= value; s.stats.expense += value;
  s.today[cat] = (s.today[cat] || 0) + value; s.hourNow.expense += value;
}
export function receive(sim, value) {
  const s = sim.s;
  s.cash += value; s.stats.revenue += value; s.today.revenue += value; s.hourNow.revenue += value;
}

const SPOT_BASE = () => MODELS['MS 170'].price * .82;
export const spotPrice = (s) => Math.round(SPOT_BASE() * s.spot.factor);

function makeOffer(s) {
  const qty = 5 + Math.floor(rng(s) * 14) * (s.stats.sold > 150 ? 2 : 1);
  const export_ = s.stats.sold > 100 && rng(s) < .2;
  const unit = Math.round(MODELS['MS 170'].price * (.92 + rng(s) * .2) * (export_ ? 1.15 : 1) * (1 + (s.reputation - 50) / 800));
  const urgent = rng(s) < .2;
  const hours = Math.ceil(qty / 2) + (urgent ? 1 : 4) + Math.floor(rng(s) * 3);
  return { id: nextId(s), client: CLIENTS[Math.floor(rng(s) * CLIENTS.length)], qty, unit: urgent ? Math.round(unit * 1.12) : unit,
    urgent, export: export_, hours, ttl: 75, deadline: 0, shipped: 0 };
}

export function acceptOffer(sim, id) {
  const s = sim.s, i = s.offers.findIndex((o) => o.id === id);
  if (i < 0) return { ok: false };
  const o = s.offers.splice(i, 1)[0];
  o.deadline = o.hours * GAME.hourSeconds;
  s.orders.push(o);
  return { ok: true, msg: `Pedido aceito: ${o.qty} unidades para ${o.client}.` };
}
export function declineOffer(sim, id) { sim.s.offers = sim.s.offers.filter((o) => o.id !== id); return { ok: true }; }

export function shipOrder(sim, id) {
  const s = sim.s, o = s.orders.find((x) => x.id === id);
  if (!o) return { ok: false };
  const q = Math.min(o.qty - o.shipped, s.finished);
  if (q <= 0) return { ok: false, msg: 'Não há motosserras prontas na expedição.' };
  s.finished -= q; o.shipped += q;
  pay(sim, GAME.freightOut, 'other');
  s.shipments.push({ id: nextId(s), label: o.client, qty: q, value: q * o.unit, t: GAME.shipSeconds });
  sim.emit('truck', { kind: 'out' });
  if (o.shipped >= o.qty) {
    s.orders = s.orders.filter((x) => x.id !== id);
    s.reputation = Math.min(100, s.reputation + (o.urgent ? 3 : 1.5));
    sim.emit('toast', { kind: 'good', text: `Pedido de ${o.client} despachado.` });
  }
  return { ok: true, msg: `${q} unidades em transporte.` };
}

export function sellSpot(sim, qty) {
  const s = sim.s;
  const q = Math.min(qty, s.finished);
  if (q <= 0) return { ok: false, msg: 'Não há motosserras prontas na expedição.' };
  let total = 0;
  for (let i = 0; i < q; i++) { total += spotPrice(s); s.spot.factor = Math.max(.55, s.spot.factor * .985); }
  s.finished -= q;
  pay(sim, GAME.freightOut, 'other');
  s.shipments.push({ id: nextId(s), label: 'Mercado', qty: q, value: total, t: GAME.shipSeconds });
  sim.emit('truck', { kind: 'out' });
  return { ok: true, msg: `${q} unidades vendidas. R$ ${total.toLocaleString('pt-BR')} chegam com a entrega.` };
}

export function takeLoan(sim, v) {
  const s = sim.s;
  if (s.loan + v > 600000) return { ok: false, msg: 'O limite de crédito é de R$ 600.000.' };
  s.loan += v; s.cash += v;
  return { ok: true, msg: `Empréstimo de R$ ${v.toLocaleString('pt-BR')} liberado. Juros de 0,8% ao dia.` };
}
export function repayLoan(sim, v) {
  const s = sim.s, q = Math.min(v, s.loan);
  if (q <= 0) return { ok: false, msg: 'Não há dívida para pagar.' };
  if (s.cash < q) return { ok: false, msg: 'Falta dinheiro para quitar este valor.' };
  s.loan -= q; s.cash -= q;
  return { ok: true, msg: `R$ ${q.toLocaleString('pt-BR')} de dívida quitados.` };
}

function closeDay(sim) {
  const s = sim.s;
  const wages = s.workers.reduce((a, w) => a + w.salary, 0);
  pay(sim, wages, 'wages');
  pay(sim, s.kwh * GAME.tariff, 'energy'); s.kwh = 0;
  pay(sim, GAME.overheadDay, 'other');
  if (s.loan > 0) pay(sim, s.loan * .008, 'other');
  const e = computeEfficiency(s), t = s.today;
  const expense = t.parts + t.wages + t.energy + t.maint + t.build + t.other;
  s.days.push({ day: s.day, ...t, expense, profit: t.revenue - expense, oee: e.oee });
  s.days = s.days.slice(-30);
  sim.emit('toast', { kind: t.revenue - expense >= 0 ? 'good' : 'warn', text: `Dia ${s.day} fechado: resultado de R$ ${Math.round(t.revenue - expense).toLocaleString('pt-BR')}.` });
  s.day++; s.today = blankDay();
  for (const w of s.workers) w.fatigue = Math.max(0, w.fatigue - .5); // recuperação entre expedientes
}

export function updateEconomy(sim, dt) {
  const s = sim.s;
  // Energia: iluminação, esteiras e estações.
  let kw = 6 + Object.keys(s.belts).length * .15;
  for (const b of s.buildings) if (isStation(b)) kw += stationPower(b);
  s.kw = kw; s.kwh += kw * dt / GAME.hourSeconds;

  s.spot.factor = Math.min(1, s.spot.factor + .0006 * dt);

  s.nextOfferIn -= dt;
  if (s.nextOfferIn <= 0 && s.offers.length < 4) { s.offers.push(makeOffer(s)); s.nextOfferIn = 55 + rng(s) * 45; }
  for (const o of s.offers) o.ttl -= dt;
  s.offers = s.offers.filter((o) => o.ttl > 0);

  for (const o of s.orders) {
    o.deadline -= dt;
    if (o.deadline <= 0) {
      const left = o.qty - o.shipped, fine = Math.round(left * o.unit * .1);
      pay(sim, fine, 'other'); s.reputation = Math.max(0, s.reputation - 6);
      sim.emit('toast', { kind: 'bad', text: `Pedido de ${o.client} venceu. Multa de R$ ${fine.toLocaleString('pt-BR')}.` });
    }
  }
  s.orders = s.orders.filter((o) => o.deadline > 0);

  if (s.autoShip && s.finished > 0) {
    // Envia quando o pedido inteiro está pronto, ou o que houver quando faltar pouco tempo.
    for (const o of s.orders) {
      const left = o.qty - o.shipped;
      if (s.finished >= left || (o.deadline < 30 && s.finished > 0)) shipOrder(sim, o.id);
    }
  }

  for (const sh of s.shipments) {
    sh.t -= dt;
    if (sh.t <= 0) { receive(sim, sh.value); s.stats.sold += sh.qty; sim.emit('toast', { kind: 'good', text: `Recebido R$ ${Math.round(sh.value).toLocaleString('pt-BR')} de ${sh.label}.` }); }
  }
  s.shipments = s.shipments.filter((x) => x.t > 0);

  // Relógio: fecha a hora e o dia de trabalho.
  s.hourClock += dt;
  if (s.hourClock >= GAME.hourSeconds) {
    s.hourClock -= GAME.hourSeconds;
    const e = computeEfficiency(s);
    s.hours.push({ ...s.hourNow, oee: e.oee, cash: s.cash });
    s.hours = s.hours.slice(-48);
    s.rateHour = s.hourNow.produced; s.hourNow = blankHour();
    s.hourIndex = (s.hourIndex || 0) + 1;
    if (s.hourIndex >= GAME.shiftHours) { s.hourIndex = 0; closeDay(sim); }
  }
}
