import { BUILDINGS, SECTORS } from '../config.js';

// Ocupação da grade e pathfinding A*. Esteiras podem ser cruzadas com custo maior (passarelas).
export function buildingAt(s, x, y) {
  return s.buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null;
}
export const beltAt = (s, x, y) => s.belts[`${x},${y}`] || null;
export const inHall = (s, x, y) => x >= 0 && y >= 0 && x < s.hall.w && y < s.hall.h;
export const canPlace = (s, x, y, w, h) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    if (!inHall(s, i, j) || buildingAt(s, i, j) || beltAt(s, i, j)) return false;
  }
  return true;
};

export const zoneAt = (s, x, y) => s.zones.find((z) => x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) || null;
export const zoneById = (s, id) => s.zones.find((z) => z.id === id);

// Regra de construção: cada equipamento fica no seu prédio; esteiras podem ir a qualquer lugar.
export function placementError(s, type, x, y) {
  const d = BUILDINGS[type];
  if (d.front && y + d.h !== s.hall.h) return 'A doca precisa encostar na parede frontal.';
  if (!canPlace(s, x, y, d.w, d.h)) return 'Esse espaço está ocupado ou fora do terreno.';
  if (d.zone) {
    const z = zoneAt(s, x, y), z2 = zoneAt(s, x + d.w - 1, y + d.h - 1);
    if (!z || z !== z2) return d.zone === 'any' ? 'Construa dentro de um prédio.' : `Construa dentro de ${SECTORS[d.zone].name}.`;
    if (d.zone !== 'any' && (z.sector || z.id) !== d.zone) return `${d.name} fica em ${SECTORS[d.zone].name}. Construa esse prédio em Complexo.`;
    for (const door of z.doors) if (door.x >= x && door.x < x + d.w && door.y >= y && door.y < y + d.h) return 'Não bloqueie a porta do prédio.';
  }
  return null;
}

export function findPath(s, sx, sy, tx, ty) {
  const W = s.hall.w, H = s.hall.h;
  if (!inHall(s, tx, ty)) return null;
  sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
  const key = (x, y) => y * W + x;
  const blocked = new Uint8Array(W * H);
  for (const b of s.buildings) for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) if (inHall(s, i, j)) blocked[key(i, j)] = 1;
  // Paredes: entre dentro e fora do prédio só se passa pela porta.
  const zone = new Int8Array(W * H), door = new Uint8Array(W * H);
  s.zones.forEach((z, zi) => {
    for (let j = z.y; j < z.y + z.h; j++) for (let i = z.x; i < z.x + z.w; i++) if (inHall(s, i, j)) zone[key(i, j)] = zi + 1;
    for (const d of z.doors) door[key(d.x, d.y)] = 1;
  });
  const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  // Fila de prioridade: mantém o caminho rápido mesmo com o complexo inteiro construído.
  const heap = [], f = new Float32Array(W * H);
  const push = (k) => { heap.push(k); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[key(sx, sy)] = 0;
  const h = (k) => Math.abs((k % W) - tx) + Math.abs(Math.floor(k / W) - ty);
  const goal = key(tx, ty);
  f[key(sx, sy)] = h(key(sx, sy)); push(key(sx, sy));
  while (heap.length) {
    const c = pop();
    if (closed[c]) continue;
    if (c === goal) {
      const out = []; let k = c;
      while (k !== -1 && k !== key(sx, sy)) { out.push({ x: k % W, y: Math.floor(k / W) }); k = from[k]; }
      return out.reverse();
    }
    closed[c] = 1;
    const cx = c % W, cy = Math.floor(c / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = key(nx, ny);
      if (closed[n] || (blocked[n] && n !== goal)) continue;
      if (zone[n] !== zone[c] && !(zone[c] ? door[c] : door[n])) continue;
      const ng = g[c] + (s.belts[`${nx},${ny}`] ? 4 : 1);
      if (ng < g[n]) { g[n] = ng; from[n] = c; f[n] = ng + h(n); push(n); }
    }
  }
  return null;
}

// Célula livre ao redor de um prédio, preferindo a frente e evitando esteiras.
export function accessTile(s, b, fromX, fromY) {
  const cells = [];
  for (let i = b.x; i < b.x + b.w; i++) { cells.push([i, b.y + b.h, 0], [i, b.y - 1, .5]); }
  for (let j = b.y; j < b.y + b.h; j++) { cells.push([b.x - 1, j, .5], [b.x + b.w, j, .5]); }
  let best = null, bs = Infinity;
  const home = zoneAt(s, b.x, b.y);
  for (const [x, y, pref] of cells) {
    if (!inHall(s, x, y) || buildingAt(s, x, y) || zoneAt(s, x, y) !== home) continue;
    const score = Math.abs(x - fromX) * .05 + Math.abs(y - fromY) * .05 + pref + (beltAt(s, x, y) ? 6 : 0);
    if (score < bs) { bs = score; best = { x, y }; }
  }
  return best;
}
