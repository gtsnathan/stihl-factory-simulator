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

export function findPath(s, sx, sy, tx, ty) {
  const W = s.hall.w, H = s.hall.h;
  if (!inHall(s, tx, ty)) return null;
  sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
  const key = (x, y) => y * W + x;
  const blocked = new Uint8Array(W * H);
  for (const b of s.buildings) for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) if (inHall(s, i, j)) blocked[key(i, j)] = 1;
  const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const open = [key(sx, sy)]; g[open[0]] = 0;
  const h = (k) => Math.abs((k % W) - tx) + Math.abs(Math.floor(k / W) - ty);
  const goal = key(tx, ty);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (g[open[i]] + h(open[i]) < g[open[bi]] + h(open[bi])) bi = i;
    const c = open.splice(bi, 1)[0];
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
      const ng = g[c] + (s.belts[`${nx},${ny}`] ? 4 : 1);
      if (ng < g[n]) { g[n] = ng; from[n] = c; if (!open.includes(n)) open.push(n); }
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
  for (const [x, y, pref] of cells) {
    if (!inHall(s, x, y) || buildingAt(s, x, y)) continue;
    const score = Math.abs(x - fromX) * .05 + Math.abs(y - fromY) * .05 + pref + (beltAt(s, x, y) ? 6 : 0);
    if (score < bs) { bs = score; best = { x, y }; }
  }
  return best;
}
