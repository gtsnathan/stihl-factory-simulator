// Gráficos em canvas. A escala do eixo Y sempre sai dos dados.
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return v; };
export const compact = (v) => { const a = Math.abs(v); return a >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : a >= 1e3 ? `${Math.round(v / 1e3)} mil` : `${Math.round(v * 10) / 10}`; };

export function drawChart(canvas, series, opts = {}) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth || 300, H = canvas.clientHeight || 130;
  if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const css = getComputedStyle(canvas), muted = css.getPropertyValue('--muted'), line = css.getPropertyValue('--line');
  const L = 42, R = 6, T = 8, B = 16, pw = W - L - R, ph = H - T - B;
  const n = Math.max(...series.map((s) => s.data.length));
  g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
  if (!n) { g.fillStyle = muted; g.textAlign = 'center'; g.fillText('Os dados aparecem depois da primeira hora.', W / 2, H / 2); return; }
  const max = opts.max || niceMax(Math.max(...series.flatMap((s) => s.data), 0));
  g.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const y = T + ph - ph * i / 3;
    g.strokeStyle = line; g.globalAlpha = .55; g.beginPath(); g.moveTo(L, y + .5); g.lineTo(W - R, y + .5); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = muted; g.fillText(opts.pct ? `${Math.round(max * i / 3 * 100)}%` : compact(max * i / 3), L - 5, y);
  }
  const X = (i) => L + (n > 1 ? pw * i / (n - 1) : pw / 2);
  const Y = (v) => T + ph - ph * Math.min(1, v / max);
  series.forEach((s) => {
    if (opts.bars) {
      const bw = Math.max(2, pw / n * .62 / series.length), idx = series.indexOf(s);
      g.fillStyle = s.color;
      s.data.forEach((v, i) => { const x = L + pw * (i + .5) / n - bw * series.length / 2 + idx * bw; g.fillRect(x, Y(v), bw - 1, T + ph - Y(v)); });
      return;
    }
    g.beginPath(); s.data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
    g.strokeStyle = s.color; g.lineWidth = 1.8; g.stroke();
    if (series.length === 1) { g.lineTo(X(s.data.length - 1), T + ph); g.lineTo(X(0), T + ph); g.closePath(); g.fillStyle = s.color; g.globalAlpha = .13; g.fill(); g.globalAlpha = 1; }
    const li = s.data.length - 1; g.beginPath(); g.arc(X(li), Y(s.data[li]), 2.6, 0, 7); g.fillStyle = s.color; g.fill();
  });
  g.fillStyle = muted; g.textAlign = 'left'; g.fillText(opts.xLabel || `últimas ${n} h`, L, H - 7);
}
