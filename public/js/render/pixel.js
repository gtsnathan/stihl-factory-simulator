// Pintor de pixel art: desenha polígonos sem suavização num buffer RGBA.
export const shade = (c, f) => {
  const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};
export const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

export class Pix {
  constructor(w, h, ox = 0, oy = 0) {
    this.w = Math.ceil(w); this.h = Math.ceil(h); this.ox = ox; this.oy = oy; // origem: canto superior do tile (0,0), z=0
    this.d = new Uint8ClampedArray(this.w * this.h * 4);
  }
  px(x, y, c, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d, sa = a, da = d[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    const m = (s, o) => (s * sa + o * da * (1 - sa)) / oa;
    d[i] = m((c >> 16) & 255, d[i]); d[i + 1] = m((c >> 8) & 255, d[i + 1]); d[i + 2] = m(c & 255, d[i + 2]); d[i + 3] = oa * 255;
  }
  rect(x, y, w, h, c, a = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx - dy;
    for (let n = 0; n < 4000; n++) {
      this.px(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 > -dy) { e -= dy; x0 += sx; }
      if (e2 < dx) { e += dx; y0 += sy; }
    }
  }
  poly(pts, c, a = 1) {
    let top = Infinity, bot = -Infinity;
    for (const p of pts) { top = Math.min(top, p[1]); bot = Math.max(bot, p[1]); }
    const fn = typeof c === 'function' ? c : null;
    for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
      const xs = [], yy = y + .5;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + (yy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, fn ? fn(x, y) : c, a);
      }
    }
  }
  // Espaço isométrico: a e b em tiles, z em pixels para cima.
  P(a, b, z = 0) { return [this.ox + (a - b) * 32, this.oy + (a + b) * 16 - z]; }
  top(a0, a1, b0, b1, z, c, al = 1) { this.poly([this.P(a0, b0, z), this.P(a1, b0, z), this.P(a1, b1, z), this.P(a0, b1, z)], c, al); }
  faceB(b, a0, a1, z0, z1, c, al = 1) { this.poly([this.P(a0, b, z1), this.P(a1, b, z1), this.P(a1, b, z0), this.P(a0, b, z0)], c, al); } // face voltada à esquerda-baixo
  faceA(a, b0, b1, z0, z1, c, al = 1) { this.poly([this.P(a, b0, z1), this.P(a, b1, z1), this.P(a, b1, z0), this.P(a, b0, z0)], c, al); } // face voltada à direita-baixo
  box(a0, a1, b0, b1, z0, z1, c, opt = {}) {
    const t = opt.top ?? shade(c, 1.18), l = opt.left ?? shade(c, .82), r = opt.right ?? shade(c, .6);
    this.faceB(b1, a0, a1, z0, z1, l); this.faceA(a1, b0, b1, z0, z1, r); this.top(a0, a1, b0, b1, z1, t);
    if (opt.edge !== false) {
      const hi = shade(t, 1.18), lo = shade(r, .7);
      this.line(...this.P(a0, b1, z1), ...this.P(a1, b1, z1), hi);
      this.line(...this.P(a1, b1, z1), ...this.P(a1, b0, z1), hi);
      this.line(...this.P(a1, b1, z1), ...this.P(a1, b1, z0), lo);
    }
  }
  shadow(a0, a1, b0, b1, alpha = .32) { this.top(a0 + .06, a1 + .22, b0 + .06, b1 + .22, 0, 0x05070a, alpha); }
  hazard(a0, a1, b0, b1, z = 0) { // faixa amarela e preta no piso
    const P = this;
    P.poly([P.P(a0, b0, z), P.P(a1, b0, z), P.P(a1, b1, z), P.P(a0, b1, z)], (x, y) => (((x + y * 2) >> 3) & 1 ? 0xe6b422 : 0x1d1f22));
  }
  toCanvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}
