import { GAME, BUILDINGS, COMPONENTS, ROLES, FIRST_NAMES, LAST_NAMES, STATION_STAGES } from '../config.js';

export function nextId(s) { return s.nextId++; }

// Gerador determinístico guardado no save: a mesma semente gera a mesma partida.
export function rng(s) {
  s.seed = (s.seed + 0x6D2B79F5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function makeBuilding(s, type, x, y) {
  const d = BUILDINGS[type];
  const b = { id: nextId(s), type, x, y, w: d.w, h: d.h };
  if (STATION_STAGES[type]) {
    Object.assign(b, {
      status: 'no_operator', progress: 0, busy: false, inbox: 0, outbox: 0, buffer: {},
      wear: 0, hours: 0, broken: false, repairT: 0, externalRepair: false, history: [],
      t: { run: 0, starved: 0, blocked: 0, broken: 0, absent: 0 }, done: 0, good: 0, bad: 0, rr: 0, operatorId: null, supplyBy: null, techBy: null,
    });
  }
  if (type === 'pallet') { b.count = 0; b.claim = null; }
  return b;
}

export function makeWorker(s, role, x, y) {
  const r = (a) => a[Math.floor(rng(s) * a.length)];
  return {
    id: nextId(s), role, name: `${r(FIRST_NAMES)} ${r(LAST_NAMES)}`, salary: ROLES[role].salary,
    base: 0.92 + rng(s) * 0.12, train: 0, xp: 0, fatigue: rng(s) * 0.12,
    x: x + .5, y: y + .5, path: [], state: 'idle', job: null, carry: null, carryQty: 0,
    fx: 1, fy: 0, moving: false, working: false, gv: -1, wait: 0, skin: Math.floor(rng(s) * 3),
  };
}

export function newGame(seed = Date.now() | 0) {
  const s = {
    v: 1, seed, nextId: 1, time: 0, day: 1, hourClock: 0, speed: 1,
    cash: GAME.startCash, hall: { ...GAME.hall }, gridVer: 1,
    buildings: [], belts: {}, workers: [], stock: {}, finished: 0,
    deliveries: [], shipments: [], offers: [], orders: [], nextOfferIn: 6,
    spot: { factor: 1 }, autoBuy: false, autoShip: true, autoBuyTarget: 25,
    reputation: 50, loan: 0, research: { done: {}, active: null },
    stats: { produced: 0, sold: 0, scrapped: 0, reworked: 0, revenue: 0, expense: 0 },
    today: blankDay(), hourNow: blankHour(), hours: [], days: [], ledger: {}, objectives: {}, kwh: 0, kw: 0,
    eff: { oee: 0, avail: 0, perf: 0, qual: 1 }, rateHour: 0, warnStock: 0,
  };
  Object.keys(COMPONENTS).forEach((k) => { s.stock[k] = k === 'parafusos' ? 120 : 30; });

  const put = (type, x, y) => { const b = makeBuilding(s, type, x, y); s.buildings.push(b); return b; };
  put('depot', 1, 9);
  put('st1', 2, 4); put('st2', 7, 4); put('st3', 12, 4);
  put('pallet', 16, 4);
  put('rest', 9, 10);
  put('dock', 15, 10);
  for (const x of [4, 5, 6, 9, 10, 11, 14, 15]) s.belts[`${x},5`] = { id: nextId(s), x, y: 5, dir: 'E', kind: 'belt', items: [] };

  // Abastece as estações com material para iniciar produzindo logo no começo.
  for (const b of s.buildings) {
    const def = STATION_STAGES[b.type];
    if (def) for (const k in def.mats) { b.buffer[k] = def.mats[k] * 2; s.stock[k] -= def.mats[k] * 2; }
  }

  s.workers.push(makeWorker(s, 'assembler', 3, 7), makeWorker(s, 'assembler', 8, 7), makeWorker(s, 'assembler', 13, 7),
    makeWorker(s, 'stock', 5, 8), makeWorker(s, 'fork', 16, 8));
  return s;
}

export const blankDay = () => ({ revenue: 0, parts: 0, wages: 0, energy: 0, maint: 0, build: 0, other: 0, produced: 0, scrapped: 0 });
export const blankHour = () => ({ produced: 0, revenue: 0, expense: 0 });
