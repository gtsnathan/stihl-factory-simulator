import { BUILDINGS, GAME, RESEARCH, STATION_STAGES } from '../config.js';
import { canPlace, beltAt, buildingAt } from './grid.js';
import { makeBuilding, newGame } from './state.js';
import { updateStation, isStation } from '../systems/machines.js';
import { updateWorker } from '../systems/workers.js';
import { updateBelts, placeBelt } from '../systems/logistics.js';
import { updateInventory, stockUsed, depotCapacity, dockCapacity } from '../systems/inventory.js';
import { updateEconomy, pay } from '../systems/economy.js';
import { computeEfficiency } from '../systems/production.js';

// Simulação pura: passo fixo, sem depender do Phaser nem da taxa de quadros.
export class Simulation {
  constructor(state) { this.s = state || newGame(); this.listeners = {}; this.acc = 0; this.effT = 0; }
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach((f) => f(data)); }

  advance(realDt) {
    this.acc += Math.min(realDt, 5) * this.s.speed;
    let n = 0;
    while (this.acc >= GAME.tick && n < 600) { this.step(GAME.tick); this.acc -= GAME.tick; n++; }
    if (n === 600) this.acc = 0;
  }
  step(dt) {
    const s = this.s; s.time += dt;
    for (const w of s.workers) updateWorker(this, w, dt);
    updateBelts(this, dt);
    for (const b of s.buildings) if (isStation(b)) updateStation(this, b, dt);
    updateInventory(this, dt);
    updateEconomy(this, dt);
    if (s.research.active) {
      s.research.active.t -= dt;
      if (s.research.active.t <= 0) {
        s.research.done[s.research.active.id] = true;
        this.emit('toast', { kind: 'good', text: `Pesquisa concluída: ${RESEARCH[s.research.active.id].name}.` });
        s.research.active = null;
      }
    }
    this.effT -= dt;
    if (this.effT <= 0) { this.effT = 1; s.eff = computeEfficiency(s); this.objectives(); }
  }
  objectives() {
    const s = this.s, o = s.objectives;
    const list = [['first', s.stats.produced >= 1, 'Primeira MS 170 pronta'], ['sold', s.stats.sold >= 10, '10 motosserras vendidas']];
    for (const [k, ok, t] of list) if (ok && !o[k]) { o[k] = true; this.emit('toast', { kind: 'good', text: `Objetivo cumprido: ${t}.` }); }
  }

  // Comandos do jogador
  build(type, x, y, dir = 'E') {
    const s = this.s, d = BUILDINGS[type];
    if (!d) return { ok: false };
    if (s.cash < d.cost) return { ok: false, msg: 'Falta dinheiro para construir.' };
    if (!canPlace(s, x, y, d.w, d.h)) return { ok: false, msg: 'Esse espaço está ocupado ou fora do galpão.' };
    pay(this, d.cost, 'build');
    if (type === 'belt' || type === 'split') placeBelt(s, x, y, dir, type);
    else s.buildings.push(makeBuilding(s, type, x, y));
    s.gridVer++;
    return { ok: true };
  }
  setBeltDir(x, y, dir) { const c = beltAt(this.s, x, y); if (c && c.kind === 'belt') c.dir = dir; }
  remove(x, y) {
    const s = this.s, c = beltAt(s, x, y);
    if (c) {
      delete s.belts[`${x},${y}`];
      s.cash += Math.round(BUILDINGS[c.kind].cost * .5); s.gridVer++;
      return { ok: true };
    }
    const b = buildingAt(s, x, y);
    if (!b) return { ok: false, msg: 'Não há nada para remover aqui.' };
    if (b.type === 'depot' && (s.buildings.filter((q) => q.type === 'depot').length === 1 || stockUsed(s) > depotCapacity(s) - BUILDINGS.depot.cap)) return { ok: false, msg: 'Esvazie o estoque ou construa outro depósito antes.' };
    if (b.type === 'dock' && (s.buildings.filter((q) => q.type === 'dock').length === 1 || s.finished > dockCapacity(s) - BUILDINGS.dock.cap)) return { ok: false, msg: 'Despache as motosserras ou construa outra expedição antes.' };
    if (STATION_STAGES[b.type]) for (const k in b.buffer) s.stock[k] += b.buffer[k]; // material volta ao estoque
    s.buildings = s.buildings.filter((q) => q.id !== b.id);
    s.cash += Math.round(BUILDINGS[b.type].cost * .5); s.gridVer++;
    return { ok: true, msg: `${BUILDINGS[b.type].name} removido. Metade do valor voltou ao caixa.` };
  }
  expandHall() {
    const s = this.s;
    if (s.hall.w >= GAME.hallMax.w) return { ok: false, msg: 'O galpão já está no tamanho máximo.' };
    if (s.cash < GAME.expansionCost) return { ok: false, msg: 'Falta dinheiro para ampliar.' };
    pay(this, GAME.expansionCost, 'build');
    s.hall.w += 4; s.gridVer++;
    this.emit('hall', {});
    return { ok: true, msg: `Galpão ampliado para ${s.hall.w} × ${s.hall.h} células.` };
  }
  startResearch(id) {
    const s = this.s, r = RESEARCH[id];
    if (s.research.active) return { ok: false, msg: 'Já há uma pesquisa em andamento.' };
    if (s.research.done[id]) return { ok: false, msg: 'Pesquisa já concluída.' };
    if (s.cash < r.cost) return { ok: false, msg: 'Falta dinheiro para esta pesquisa.' };
    pay(this, r.cost, 'other');
    s.research.active = { id, t: r.seconds };
    return { ok: true, msg: `Pesquisa iniciada: ${r.name}.` };
  }
}
