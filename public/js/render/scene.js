/* global Phaser */
import { BUILDINGS, DIRS, GAME, NEXT_DIR, STATION_STAGES } from '../config.js';
import { buildingAt, beltAt } from '../core/grid.js';
import { buildAllTextures, buildFloorTexture, buildWallTextures } from './textures.js';

const TW = 32, TH = 16;
export const iso = (x, y) => ({ x: (x - y) * TW, y: (x + y) * TH });
const DEPTH = { yard: -100000, floor: -90000, wallBack: -80000, belt: -70000, ghost: 900000, lamps: 950000 };
const objDepth = (x, y) => (x + y) * 100;

export class FactoryScene extends Phaser.Scene {
  constructor() { super('factory'); }
  init(data) { this.sim = data.sim; this.ui = data.ui; }

  create() {
    buildAllTextures(this);
    this.maps = { b: new Map(), belt: new Map(), item: new Map(), w: new Map() };
    this.layout = { type: null, dir: 'E', mode: null };
    this.anim = 0; this.frame = 0;
    this.trucks = [];
    this.buildHall();

    this.input.addPointer(2);
    this.input.mouse?.disableContextMenu();
    this.setupInput();
    this.setupKeyboard();

    this.ghost = this.add.image(0, 0, 'empty').setOrigin(0).setDepth(DEPTH.ghost).setVisible(false).setAlpha(.72);
    this.selectGfx = this.add.graphics().setDepth(DEPTH.ghost - 1);

    this.sparks = this.add.particles(0, 0, 'spark', { speed: { min: 20, max: 60 }, gravityY: 120, lifespan: 380, scale: { start: 1, end: 0 }, emitting: false, angle: { min: 200, max: 340 } }).setDepth(DEPTH.ghost - 5);

    this.sim.on('truck', (e) => this.spawnTruck(e.kind));
    this.sim.on('hall', () => this.buildHall());
    this.sim.on('breakdown', (e) => { const r = this.maps.b.get(e.id); if (r) this.sparks.explode(26, r.img.x + 60, r.img.y + 50); this.cameras.main.shake(180, .003); });

    this.scale.on('resize', () => this.clampCam());
    const cam = this.cameras.main, narrow = this.scale.width < 700;
    const centre = iso(10, 6);
    cam.setZoom(narrow ? .72 : 1.15); cam.centerOn(centre.x, centre.y + 10);
    this.ui.bindScene(this);
    this.game.events.emit('factory-ready');
    window.__scene = this;
  }

  buildHall() {
    const { w: W, h: H } = this.sim.s.hall;
    for (const k of ['floorImg', 'wa', 'wb', 'fa', 'fb', 'yard']) this[k]?.destroy();
    (this.lamps || []).forEach((l) => l.destroy());
    buildFloorTexture(this, W, H); buildWallTextures(this, W, H);
    const pad = 2;
    this.floorImg = this.add.image(-(H + pad) * TW, -(pad * 2) * TH, 'floor').setOrigin(0).setDepth(DEPTH.floor);
    this.wa = this.add.image(-2, -118 - 2, 'wallA').setOrigin(0).setDepth(DEPTH.wallBack).setAlpha(.78);
    this.wb = this.add.image(-H * TW - 2, -118 - 2, 'wallB').setOrigin(0).setDepth(DEPTH.wallBack).setAlpha(.78);
    // Paredes frontais baixas e translúcidas
    const front1 = iso(0, H), front2 = iso(W, 0);
    this.fa = this.add.image(front1.x - 2, front1.y - 20, 'wallFrontA').setOrigin(0).setDepth(objDepth(W, H)).setAlpha(.5);
    this.fb = this.add.image(front2.x - H * TW - 2, front2.y - 20, 'wallFrontB').setOrigin(0).setDepth(objDepth(W, H)).setAlpha(.5);
    this.yard = this.add.graphics().setDepth(DEPTH.yard);
    const q = (a0, a1, b0, b1, c) => {
      const p = [iso(a0, b0), iso(a1, b0), iso(a1, b1), iso(a0, b1)];
      this.yard.fillStyle(c, 1); this.yard.fillPoints(p, true);
    };
    q(-30, W + 40, -30, H + 30, 0x28352a);
    q(-12, W + 30, H + 2, H + 7, 0x2b2e33);        // pista dos caminhões
    for (let a = -12; a < W + 30; a += 3) q(a, a + 1.5, H + 4.4, H + 4.6, 0xd9dcdf);
    q(1, W, H + 2, H + 2.1, 0xe6b422);

    this.lamps = [];
    for (let a = 3; a < W; a += 6) for (let b = 3; b < H; b += 5) {
      const p = iso(a, b);
      const glow = this.add.image(p.x, p.y + TH, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.lamps).setScale(2.1, 1.05).setAlpha(.16);
      this.lamps.push(glow);
      glow.flick = (a * 7 + b * 3) % 11;
    }
    this.clampCam();
  }

  clampCam() {
    const { w: W, h: H } = this.sim.s.hall, cam = this.cameras.main, m = 220;
    cam.setBounds(-H * TW - m - 300, -m - 180, (W + H) * TW + 2 * m + 600, (W + H) * TH + 2 * m + 420);
  }

  // ------- Entrada: mouse, toque e teclado --------
  worldTile(px, py) {
    const pt = this.cameras.main.getWorldPoint(px, py);
    const a = (pt.x / TW + pt.y / TH) / 2, b = (pt.y / TH - pt.x / TW) / 2;
    return { x: Math.floor(a), y: Math.floor(b), pt };
  }
  setupInput() {
    const i = this.input;
    this.gesture = null;
    i.on('wheel', (p, _o, _dx, dy) => this.zoomAt(p.x, p.y, dy > 0 ? .88 : 1.14));
    i.on('pointerdown', (p) => {
      if (this.isPinching()) { this.gesture = { kind: 'pinch' }; this.startPinch(); return; }
      const mouseAlt = p.rightButtonDown() || p.middleButtonDown();
      const paintBelt = !mouseAlt && this.layout.type === 'belt';
      this.gesture = { kind: paintBelt ? 'paint' : 'pan', sx: p.x, sy: p.y, cx: this.cameras.main.scrollX, cy: this.cameras.main.scrollY, moved: false, alt: mouseAlt };
      if (paintBelt) { this.paintStart(this.worldTile(p.x, p.y)); }
    });
    i.on('pointermove', (p) => {
      if (this.isPinching()) { this.updatePinch(); return; }
      const t = this.worldTile(p.x, p.y);
      this.hoverTile = t; this.updateGhost(t);
      const g = this.gesture;
      if (!g || !p.isDown) return;
      if (g.kind === 'paint') { this.paintTo(t); return; }
      if (g.kind === 'pan') {
        const dx = p.x - g.sx, dy = p.y - g.sy;
        if (Math.abs(dx) + Math.abs(dy) > 8) g.moved = true;
        if (g.moved) { const c = this.cameras.main; c.scrollX = g.cx - dx / c.zoom; c.scrollY = g.cy - dy / c.zoom; }
      }
    });
    i.on('pointerup', (p) => {
      const g = this.gesture; this.gesture = null;
      if (!g || g.kind === 'pinch') return;
      if (g.kind === 'paint') { this.paintEnd(); return; }
      if (!g.moved && !g.alt) this.tap(p);
    });
  }
  isPinching() { const i = this.input; return i.pointer1.isDown && i.pointer2.isDown; }
  startPinch() { this.pinchD = 0; }
  updatePinch() {
    const a = this.input.pointer1, b = this.input.pointer2, d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (this.pinchD) {
      const cam = this.cameras.main;
      this.zoomAt(mx, my, d / this.pinchD);
      cam.scrollX -= (mx - this.pinchM.x) / cam.zoom; cam.scrollY -= (my - this.pinchM.y) / cam.zoom;
    }
    this.pinchD = d; this.pinchM = { x: mx, y: my };
    this.gesture = { kind: 'pinch' };
  }
  zoomAt(px, py, f) {
    const c = this.cameras.main, before = c.getWorldPoint(px, py);
    c.setZoom(Phaser.Math.Clamp(c.zoom * f, .4, 3)); c.preRender();
    const after = c.getWorldPoint(px, py);
    c.scrollX += before.x - after.x; c.scrollY += before.y - after.y;
  }
  setupKeyboard() {
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,R,ESC');
    this.input.keyboard?.on('keydown-R', () => this.rotate());
    this.input.keyboard?.on('keydown-ESC', () => this.ui.cancelBuild());
    this.input.keyboard?.on('keydown-SPACE', () => this.ui.togglePause());
  }

  // ------- Construção --------
  setBuildMode(type, mode) {
    this.layout.type = type; this.layout.mode = mode;
    if (!type) this.ghost.setVisible(false);
    else if (this.hoverTile) this.updateGhost(this.hoverTile);
  }
  rotate() { this.layout.dir = NEXT_DIR[this.layout.dir]; if (this.hoverTile) this.updateGhost(this.hoverTile); return this.layout.dir; }
  ghostKey(type) {
    if (type === 'belt') return `belt_${this.layout.dir}_0`;
    if (type === 'split') return 'split_0';
    if (STATION_STAGES[type]) return `${type}_0`;
    if (type === 'depot' || type === 'dock') return `${type}_2`;
    if (type === 'pallet') return 'pallet_3';
    return `${type}_0`;
  }
  updateGhost(t) {
    const type = this.layout.type;
    if (!type) { this.ghost.setVisible(false); return; }
    const d = BUILDINGS[type];
    const free = !buildingAt(this.sim.s, t.x, t.y);
    let ok = true;
    for (let j = t.y; j < t.y + d.h; j++) for (let i = t.x; i < t.x + d.w; i++) {
      if (i < 0 || j < 0 || i >= this.sim.s.hall.w || j >= this.sim.s.hall.h || buildingAt(this.sim.s, i, j) || beltAt(this.sim.s, i, j)) ok = false;
    }
    const key = this.ghostKey(type), tex = this.textures.get(key).getSourceImage(), p = iso(t.x, t.y);
    this.ghost.setTexture(key).setVisible(free || !ok);
    const belt = type === 'belt' || type === 'split';
    this.ghost.setPosition(belt ? p.x - 32 : p.x - d.h * TW, belt ? p.y - 12 : p.y - (tex.height - (d.w + d.h) * TH));
    this.ghost.setTint(ok ? 0x9dffb0 : 0xff7a7a);
  }
  paintStart(t) { this.lastPaint = null; this.placed = []; this.paintTo(t); }
  paintTo(t) {
    const last = this.lastPaint;
    if (last && last.x === t.x && last.y === t.y) return;
    if (!last) { this.placeBeltAt(t.x, t.y, this.layout.dir); this.lastPaint = { x: t.x, y: t.y }; return; }
    let { x, y } = last, guard = 0;
    while ((x !== t.x || y !== t.y) && guard++ < 60) {
      const stepX = x !== t.x;
      const dir = stepX ? (t.x > x ? 'E' : 'W') : (t.y > y ? 'S' : 'N');
      this.sim.setBeltDir(x, y, dir);
      x += DIRS[dir][0]; y += DIRS[dir][1];
      this.placeBeltAt(x, y, dir);
      this.layout.dir = dir;
    }
    this.lastPaint = { x, y };
  }
  placeBeltAt(x, y, dir) {
    if (buildingAt(this.sim.s, x, y) || beltAt(this.sim.s, x, y)) return;
    const r = this.sim.build('belt', x, y, dir);
    if (!r.ok && !this.warned) { this.ui.toast('bad', r.msg); this.warned = true; setTimeout(() => { this.warned = false; }, 1500); }
  }
  paintEnd() { this.lastPaint = null; }

  tap(p) {
    const t = this.worldTile(p.x, p.y), L = this.layout;
    if (L.mode === 'remove') { const r = this.sim.remove(t.x, t.y); if (!r.ok || r.msg) this.ui.toast(r.ok ? 'good' : 'bad', r.msg); return; }
    if (L.type) {
      const r = this.sim.build(L.type, t.x, t.y, L.dir);
      if (!r.ok) this.ui.toast('bad', r.msg); else this.ui.toast('good', `${BUILDINGS[L.type].name} construído.`);
      return;
    }
    const pt = t.pt;
    const hit = this.sim.s.workers.find((w) => { const q = iso(w.x, w.y); return Math.abs(q.x - pt.x) < 14 && pt.y < q.y + 4 && pt.y > q.y - 28; });
    if (hit) { this.ui.selectWorker(hit.id); return; }
    const belt = beltAt(this.sim.s, t.x, t.y);
    const b = buildingAt(this.sim.s, t.x, t.y);
    if (b) this.ui.selectBuilding(b.id); else if (belt) this.ui.selectBelt(belt.x, belt.y); else this.ui.clearSelection();
  }

  // ------- Caminhões --------
  spawnTruck(kind) {
    const H = this.sim.s.hall.h, W = this.sim.s.hall.w, y = H + 3.2;
    const stop = kind === 'in' ? 2.5 : 15.5;
    const img = this.add.image(0, 0, 'truck').setOrigin(160 / 330, 110 / 190);
    this.trucks.push({ img, x: W + 24, y, stop, t: 0, phase: 'in', wait: 4 });
  }
  updateTrucks(dt) {
    for (const k of this.trucks) {
      if (k.phase === 'in') {
        k.x -= Math.max(1.5, Math.min(11, (k.x - k.stop) * .8)) * dt;
        if (k.x <= k.stop + .02) { k.x = k.stop; k.phase = 'wait'; }
      } else if (k.phase === 'wait') { k.wait -= dt; if (k.wait <= 0) k.phase = 'out'; } else {
        k.x += 8 * dt; if (k.x > this.sim.s.hall.w + 28) { k.img.destroy(); k.dead = true; }
      }
      if (!k.dead) { const p = iso(k.x, k.y); k.img.setPosition(p.x, p.y).setDepth(objDepth(k.x + 2, k.y + .5)); }
    }
    this.trucks = this.trucks.filter((k) => !k.dead);
  }

  // ------- Sincronização com a simulação --------
  update(_t, deltaMs) {
    const dt = Math.min(deltaMs / 1000, .1);
    const now = performance.now(); // relógio real: a simulação não depende da taxa de quadros
    if (this.ui.running) this.sim.advance((now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.anim += dt * Math.max(this.sim.s.speed, 0.0);
    this.frame += dt;
    const fr = Math.floor(this.anim * 7) % 4;

    if (this.keys) {
      const c = this.cameras.main, v = 500 * dt / c.zoom, K = this.keys;
      if (K.A.isDown || K.LEFT.isDown) c.scrollX -= v;
      if (K.D.isDown || K.RIGHT.isDown) c.scrollX += v;
      if (K.W.isDown || K.UP.isDown) c.scrollY -= v;
      if (K.S.isDown || K.DOWN.isDown) c.scrollY += v;
    }
    this.syncBuildings(fr);
    this.syncBelts(fr);
    this.syncWorkers(dt);
    this.syncItems();
    this.updateTrucks(dt * Math.max(1, this.sim.s.speed));
    this.drawSelection();
    (this.lamps || []).forEach((l) => { if (l.flick !== undefined) l.setAlpha(.15 + Math.sin(this.frame * 2 + l.flick) * .012); });
  }

  buildingKey(b, fr) {
    if (STATION_STAGES[b.type]) return `${b.type}_${b.status === 'running' ? fr : 0}`;
    const s = this.sim.s;
    if (b.type === 'depot') { const cap = BUILDINGS.depot.cap, u = Object.values(s.stock).reduce((a, c) => a + c, 0); return `depot_${Math.min(4, Math.ceil(u / cap * 4))}`; }
    if (b.type === 'dock') return `dock_${Math.min(4, Math.ceil(s.finished / BUILDINGS.dock.cap * 8))}`;
    if (b.type === 'pallet') return `pallet_${b.count}`;
    return `${b.type}_0`;
  }
  syncBuildings(fr) {
    const s = this.sim.s, seen = new Set();
    for (const b of s.buildings) {
      seen.add(b.id);
      let r = this.maps.b.get(b.id);
      const key = this.buildingKey(b, fr);
      if (!r) {
        const tex = this.textures.get(key).getSourceImage(), p = iso(b.x, b.y);
        const img = this.add.image(p.x - b.h * TW, p.y - (tex.height - (b.w + b.h) * TH), key).setOrigin(0).setDepth(objDepth(b.x + b.w / 2, b.y + b.h / 2));
        r = { img, key };
        if (STATION_STAGES[b.type]) {
          const c = iso(b.x + b.w / 2, b.y + b.h / 2);
          r.lamp = this.add.image(c.x + 18, c.y - 62, 'pixel').setDepth(img.depth + 3).setScale(3.5);
          r.alert = this.add.image(c.x, c.y - 78, 'alert').setDepth(img.depth + 4).setVisible(false);
          r.wip = this.add.image(c.x - 4, c.y - 22, 'item_1').setDepth(img.depth + 2).setVisible(false).setOrigin(.5, .7);
          r.bar = this.add.graphics().setDepth(img.depth + 5);
          r.c = c;
        }
        this.maps.b.set(b.id, r);
      }
      if (r.key !== key) { r.img.setTexture(key); r.key = key; }
      if (r.lamp) {
        const col = { running: 0x56e07d, broken: 0xe24b4b, blocked: 0xf0b13a, starved_wip: 0xf0b13a, starved_mat: 0xf0b13a, no_operator: 0x8a939c }[b.status];
        r.lamp.setTint(col);
        r.alert.setVisible(b.broken && Math.floor(this.frame * 3) % 2 === 0);
        const stage = STATION_STAGES[b.type].stage;
        r.wip.setVisible(b.busy && b.status === 'running' && stage !== 3).setTexture(`item_${Math.max(1, stage - (b.progress > .5 ? 0 : 1) || 1)}`);
        r.bar.clear();
        if (b.busy) {
          r.bar.fillStyle(0x111418, .85); r.bar.fillRect(r.c.x - 20, r.c.y - 70, 40, 4);
          r.bar.fillStyle(0xf28a3c, 1); r.bar.fillRect(r.c.x - 19, r.c.y - 69, 38 * b.progress, 2);
        }
        if (b.status === 'running' && Math.random() < .02 * s.speed) this.sparks.explode(2, r.c.x - 6, r.c.y - 26);
      }
    }
    for (const [id, r] of this.maps.b) if (!seen.has(id)) { r.img.destroy(); r.lamp?.destroy(); r.alert?.destroy(); r.wip?.destroy(); r.bar?.destroy(); this.maps.b.delete(id); }
  }
  syncBelts(fr) {
    const s = this.sim.s, seen = new Set();
    const beltFrame = Math.floor(this.anim * 9) % 4;
    for (const k in s.belts) {
      const c = s.belts[k]; seen.add(k);
      let r = this.maps.belt.get(k);
      const key = c.kind === 'split' ? `split_${fr}` : `belt_${c.dir}_${beltFrame}`;
      if (!r) {
        const p = iso(c.x, c.y);
        r = this.add.image(p.x - 32, p.y - 12, key).setOrigin(0).setDepth(DEPTH.belt + c.x + c.y);
        this.maps.belt.set(k, r);
      } else if (r.texture.key !== key) r.setTexture(key);
    }
    for (const [k, r] of this.maps.belt) if (!seen.has(k)) { r.destroy(); this.maps.belt.delete(k); }
  }
  syncItems() {
    const s = this.sim.s, seen = new Set();
    for (const k in s.belts) {
      const c = s.belts[k], [dx, dy] = DIRS[c.dir] || [0, 0];
      for (const it of c.items) {
        seen.add(it.id);
        let img = this.maps.item.get(it.id);
        if (!img) { img = this.add.image(0, 0, `item_${it.stage}`).setOrigin(18 / 36, 22 / 28); this.maps.item.set(it.id, img); }
        const u = it.p - .5;
        const x = c.x + .5 + (c.kind === 'split' ? 0 : dx * u), y = c.y + .5 + (c.kind === 'split' ? 0 : dy * u), q = iso(x, y);
        img.setPosition(q.x, q.y - 8).setDepth(objDepth(x, y) + 2);
      }
    }
    for (const [id, img] of this.maps.item) if (!seen.has(id)) { img.destroy(); this.maps.item.delete(id); }
  }
  syncWorkers(dt) {
    const s = this.sim.s, seen = new Set(), ph = Math.floor(this.anim * 8);
    for (const w of s.workers) {
      seen.add(w.id);
      let r = this.maps.w.get(w.id);
      if (!r) {
        const p0 = iso(w.x, w.y);
        r = { img: this.add.image(p0.x, p0.y, 'empty').setOrigin(.5, 1), box: this.add.image(0, 0, 'carry').setVisible(false), x: p0.x, y: p0.y, name: null };
        this.maps.w.set(w.id, r);
      }
      const target = iso(w.x, w.y), k = Math.min(1, dt * 22);
      r.x += (target.x - r.x) * k; r.y += (target.y - r.y) * k;
      // Olhar: frente = descendo na tela; costas = subindo.
      const screenDy = w.fx + w.fy, screenDx = w.fx - w.fy;
      const back = screenDy < 0 ? 1 : 0;
      const isFork = w.role === 'fork';
      if (isFork) {
        r.img.setTexture(`fork_${back}_${w.carryQty > 0 ? 1 : 0}`).setOrigin(.5, 38 / 62);
        r.img.setFlipX(back ? screenDx > 0 : screenDx < 0);
        r.box.setVisible(false);
        r.img.setPosition(r.x, r.y);
      } else {
        const f = w.moving ? 1 + ph % 2 : w.working ? 3 + ph % 2 : 0;
        r.img.setTexture(`w_${w.role}_${back}_${f}_${w.skin}`).setOrigin(.5, 1);
        r.img.setFlipX(screenDx < 0);
        r.img.setPosition(r.x, r.y + 1);
        r.box.setVisible(w.carryQty > 0).setPosition(r.x, r.y - 15).setDepth(objDepth(w.x, w.y) + 1);
      }
      r.img.setDepth(objDepth(w.x, w.y));
    }
    for (const [id, r] of this.maps.w) if (!seen.has(id)) { r.img.destroy(); r.box.destroy(); this.maps.w.delete(id); }
  }
  drawSelection() {
    const g = this.selectGfx; g.clear();
    const sel = this.ui.selectedBuilding();
    if (sel) {
      const pts = [iso(sel.x, sel.y), iso(sel.x + sel.w, sel.y), iso(sel.x + sel.w, sel.y + sel.h), iso(sel.x, sel.y + sel.h)];
      g.lineStyle(2, 0xffb066, .95); g.strokePoints(pts, true, true);
    }
    const t = this.hoverTile;
    if (t && this.layout.mode === 'remove') {
      const pts = [iso(t.x, t.y), iso(t.x + 1, t.y), iso(t.x + 1, t.y + 1), iso(t.x, t.y + 1)];
      g.lineStyle(2, 0xff6363, 1); g.strokePoints(pts, true, true);
    }
  }
}
export { GAME };
