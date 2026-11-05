import { BUILDINGS, DIRS, OPPOSITE, STATION_STAGES } from '../config.js';
import { buildingAt, beltAt } from '../core/grid.js';
import { nextId } from '../core/state.js';

const GAP = .36;
const beltSpeed = (s) => .95 * (s.research.done.fastbelt ? 1.4 : 1);
const hasRoom = (c) => !c.items.length || c.items[c.items.length - 1].p >= GAP;

function acceptBuilding(b, item) {
  const def = STATION_STAGES[b.type];
  if (def) {
    if (def.stage !== item.stage + 1 || b.inbox >= 2) return false;
    b.inbox++; return true;
  }
  if (b.type === 'pallet' && item.stage === 3 && b.count < BUILDINGS.pallet.cap) { b.count++; return true; }
  return false;
}
function moveItem(s, item, nx, ny, fromDir) {
  const c = beltAt(s, nx, ny);
  if (c) {
    if (c.kind === 'belt' && c.dir === OPPOSITE[fromDir]) return false;
    if (!hasRoom(c)) return false;
    item.p = 0; item.from = fromDir; c.items.push(item); return true;
  }
  const b = buildingAt(s, nx, ny);
  return !!b && acceptBuilding(b, item);
}

function updateBelt(s, c, dt) {
  const speed = beltSpeed(s);
  if (c.kind === 'split') {
    const it = c.items[0];
    if (!it) return;
    it.p = Math.min(1, it.p + speed * dt);
    if (it.p < 1) return;
    const dirs = ['E', 'S', 'W', 'N'];
    for (let i = 0; i < 4; i++) {
      const d = dirs[(c.rr + i) % 4];
      if (OPPOSITE[it.from] === d) continue; // não volta para a origem
      const [dx, dy] = DIRS[d], t = beltAt(s, c.x + dx, c.y + dy);
      const b = !t && buildingAt(s, c.x + dx, c.y + dy);
      if ((t && t.dir === d) || b) {
        if (moveItem(s, it, c.x + dx, c.y + dy, d)) { c.items.shift(); c.rr = (c.rr + i + 1) % 4; return; }
      }
    }
    return;
  }
  const [dx, dy] = DIRS[c.dir];
  for (let i = 0; i < c.items.length; i++) {
    const it = c.items[i];
    const limit = i === 0 ? 1 : c.items[i - 1].p - GAP;
    it.p = Math.min(limit, it.p + speed * dt);
    if (i === 0 && it.p >= 1 && moveItem(s, it, c.x + dx, c.y + dy, c.dir)) { c.items.shift(); i--; }
  }
}

export function updateBelts(sim, dt) {
  const s = sim.s;
  for (const k in s.belts) updateBelt(s, s.belts[k], dt);
}

// Só conta como saída a esteira que aponta para fora da máquina (ou um divisor encostado nela).
function outputs(s, b) {
  const list = [];
  for (let i = b.x; i < b.x + b.w; i++) { list.push([i, b.y - 1, 'N'], [i, b.y + b.h, 'S']); }
  for (let j = b.y; j < b.y + b.h; j++) { list.push([b.x - 1, j, 'W'], [b.x + b.w, j, 'E']); }
  return list.map(([x, y, d]) => ({ c: beltAt(s, x, y), d })).filter((o) => o.c && (o.c.kind === 'split' || o.c.dir === o.d));
}

export function pushToOutputs(sim, b) {
  const s = sim.s, out = outputs(s, b), stage = STATION_STAGES[b.type].stage;
  for (let i = 0; i < out.length; i++) {
    const o = out[(b.rr + i) % out.length];
    if (hasRoom(o.c) && (o.c.kind !== 'split' || !o.c.items.length)) {
      o.c.items.push({ id: nextId(s), stage, p: 0, from: o.d });
      b.outbox--; b.rr = (b.rr + i + 1) % out.length;
      return true;
    }
  }
  return false;
}

export function placeBelt(s, x, y, dir, kind = 'belt') {
  s.belts[`${x},${y}`] = { id: nextId(s), x, y, dir, kind, items: [], rr: 0 };
}

export function logisticsSummary(s) {
  let cells = 0, items = 0, stuck = 0;
  for (const k in s.belts) {
    const c = s.belts[k]; cells++; items += c.items.length;
    if (c.items.length && c.items[0].p >= 1) stuck++;
  }
  return { cells, items, stuck };
}
