import { BUILDINGS, COMPONENTS, DEPARTMENTS, GAME, MACHINES, MODELS, PHASES, RESEARCH, ROLES, SECTORS, STATION_STAGES } from '../config.js';
import { buyBuilding, callBeltService, deptActive, freeLots, machineCycle, moldOutput, openTickets, sectorEfficiency, setMold } from '../systems/sectors.js';
import { save, clearSave } from '../core/save.js';
import { cycleTime, failureChance, preventiveMaintenance, REPAIR, requestRepair } from '../systems/machines.js';
import { findBottleneck, phaseInfo, unitCost } from '../systems/production.js';
import { fire, hire, train, trainCost, workerProductivity } from '../systems/workers.js';
import { buy, depotCapacity, dockCapacity, incoming, kitFor, stockUsed } from '../systems/inventory.js';
import { acceptOffer, declineOffer, repayLoan, sellSpot, shipOrder, spotPrice, takeLoan } from '../systems/economy.js';
import { logisticsSummary } from '../systems/logistics.js';
import { truckAtBay, truckQueue } from '../systems/trucks.js';
import { beltAt } from '../core/grid.js';
import { drawChart } from './charts.js';

const money = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const pct = (v) => `${Math.round(v * 100)}%`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STATUS = {
  running: ['Produzindo', 'ok'], broken: ['Quebrada', 'bad'], blocked: ['Saída bloqueada', 'warn'],
  starved_wip: ['Aguardando peça da linha', 'warn'], starved_mat: ['Sem material', 'warn'], no_operator: ['Sem operador', 'idle'], cold: ['Forno frio ou ausente', 'warn'], stock_full: ['Estoque da peça cheio', 'idle'], waste_full: ['Resíduos cheios', 'bad'],
};
const WSTATE = { idle: 'Aguardando', work: 'Na estação', rest: 'Em descanso', toDepot: 'Indo ao depósito', toStation: 'Abastecendo estação', toPallet: 'Indo ao fim de linha', toDock: 'Levando à expedição', toMachine: 'Indo ao chamado', toOutput: 'Buscando peças', toDrop: 'Levando ao depósito' };
const TRUCK_PHASE = { approach: 'Caminhão a caminho', enter: 'Caminhão entrando', work: 'Caminhão em operação', exit: 'Caminhão saindo', leave: 'Livre' };
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const MENUS = [
  ['complex', 'Complexo', svg('<path d="M3 21V9l6 3V9l6 3V4h6v17zM7 17h2M12 17h2M17 17h2M17 12h2M17 8h2"/>')],
  ['build', 'Construção', svg('<path d="M3 20h18M6 20V9l6-5 6 5v11M10 20v-6h4v6"/>')],
  ['prod', 'Produção', svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>')],
  ['staff', 'Funcionários', svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-4 3-6 6-6s5.4 2 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .8 3 3 3.2 6"/>')],
  ['stock', 'Estoque', svg('<path d="M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9"/>')],
  ['log', 'Logística', svg('<path d="M2 7h12v10H2zM14 11h4l4 3v3h-8zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>')],
  ['maint', 'Manutenção', svg('<path d="M15 6a4 4 0 0 0-5 5l-7 7 3 3 7-7a4 4 0 0 0 5-5l-3 3-3-3z"/>')],
  ['res', 'Pesquisa', svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9"/>')],
  ['fin', 'Finanças', svg('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>')],
];

// Mantém os elementos existentes para não perder cliques nem a rolagem durante a atualização.
function morph(to, from) {
  if (to.nodeType !== from.nodeType || to.nodeName !== from.nodeName) { to.replaceWith(from.cloneNode(true)); return; }
  if (to.nodeType === 3) { if (to.nodeValue !== from.nodeValue) to.nodeValue = from.nodeValue; return; }
  if (to.nodeType !== 1) return;
  for (const a of [...to.attributes]) if (!from.hasAttribute(a.name)) to.removeAttribute(a.name);
  for (const a of [...from.attributes]) if (to.getAttribute(a.name) !== a.value) to.setAttribute(a.name, a.value);
  if (to.nodeName === 'CANVAS') return;
  const a = [...to.childNodes], b = [...from.childNodes];
  b.forEach((n, i) => { if (a[i]) morph(a[i], n); else to.appendChild(n.cloneNode(true)); });
  for (let i = b.length; i < a.length; i++) a[i].remove();
}
const row = (l, v, cls = '') => `<div class="row"><span>${l}</span><b class="${cls}">${v}</b></div>`;
const meter = (v, cls = '') => `<div class="meter ${cls}" role="img" aria-label="${pct(v)}"><i style="width:${Math.max(0, Math.min(100, v * 100))}%"></i></div>`;
const wearClass = (w) => (w > 75 ? 'bad' : w > 50 ? 'warn' : 'ok');

export class UI {
  constructor(sim, root) {
    this.sim = sim; this.root = root; this.panel = null; this.sel = null; this.running = true; this.scene = null; this.finTab = 'prod';
    this.dom = { hud: root.querySelector('#hud'), rail: root.querySelector('#rail'), panel: root.querySelector('#panel'), body: root.querySelector('#panel-body'), title: root.querySelector('#panel-title'), toast: root.querySelector('#toasts'), bar: root.querySelector('#buildbar'), info: root.querySelector('#info'), speed: root.querySelector('#speed') };
    this.dom.rail.innerHTML = MENUS.map(([id, name, ico]) => `<button data-a="menu" data-v="${id}" aria-label="${name}" title="${name}">${ico}<span>${name}</span></button>`).join('');
    root.addEventListener('click', (e) => { const t = e.target.closest('[data-a]'); if (t) this.action(t.dataset.a, t.dataset.v, t); });
    sim.on('toast', (t) => this.toast(t.kind, t.text));
    setInterval(() => this.refresh(), 400);
    this.lastSave = 0;
    setInterval(() => this.autosave(), 20000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(); });
    window.addEventListener('pagehide', () => this.autosave());
    this.refresh();
  }
  bindScene(scene) { this.scene = scene; }
  autosave() { if (save(this.sim.s)) { this.lastSave = Date.now(); this.dom.hud.dataset.saved = '1'; } }
  toast(kind, text) {
    if (!text) return;
    const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text; el.setAttribute('role', 'status');
    this.dom.toast.prepend(el);
    while (this.dom.toast.children.length > 3) this.dom.toast.lastChild.remove();
    setTimeout(() => el.remove(), 4200);
  }
  res(r) { if (r && r.msg) this.toast(r.ok ? 'good' : 'bad', r.msg); this.refresh(); }
  selectedBuilding() { return this.sel?.kind === 'b' ? this.sim.s.buildings.find((b) => b.id === this.sel.id) : null; }
  selectBuilding(id) { this.sel = { kind: 'b', id }; this.refresh(); }
  selectWorker(id) { this.sel = { kind: 'w', id }; this.refresh(); }
  selectZone(id) { this.sel = { kind: 'z', id }; this.refresh(); }
  selectBelt(x, y) { this.sel = { kind: 'c', x, y }; this.refresh(); }
  clearSelection() { this.sel = null; this.refresh(); }
  togglePause() { this.setSpeed(this.sim.s.speed === 0 ? (this.prevSpeed || 1) : 0); }
  setSpeed(v) { if (v > 0) this.prevSpeed = v; this.sim.s.speed = v; this.refresh(); }
  cancelBuild() { this.scene?.setBuildMode(null, null); this.building = null; this.refresh(); }

  action(a, v) {
    const sim = this.sim, s = sim.s, n = Number(v);
    switch (a) {
      case 'menu': this.panel = this.panel === v ? null : v; if (this.panel) this.sel = null; if (window.innerWidth < 760 && this.panel) this.cancelBuild(); break;
      case 'close': this.panel = null; break;
      case 'sel': this.sel = { kind: 'b', id: n }; if (window.innerWidth < 760) this.panel = null; break;
      case 'closeInfo': this.sel = null; break;
      case 'speed': this.setSpeed(n); break;
      case 'zoom': this.scene?.zoomAt(this.scene.scale.width / 2, this.scene.scale.height / 2, n); break;
      case 'build': this.building = v; this.scene?.setBuildMode(v, null); if (window.innerWidth < 760) this.panel = null; this.toast('good', v === 'belt' ? 'Arraste no piso para desenhar a esteira. Com dois dedos ou o botão direito, mova a câmera.' : `Toque no piso para posicionar: ${BUILDINGS[v].name}.`); break;
      case 'removeMode': this.building = 'remove'; this.scene?.setBuildMode(null, 'remove'); if (window.innerWidth < 760) this.panel = null; this.toast('warn', 'Toque no que deseja remover. Metade do valor volta ao caixa.'); break;
      case 'rotate': this.scene?.rotate(); break;
      case 'cancelBuild': this.cancelBuild(); break;
      case 'expand': this.res(sim.expandZone(v)); break;
      case 'buySector': { const r = buyBuilding(sim, v); this.res(r); if (r.ok) { this.scene?.focusZone(r.zone); this.sel = { kind: 'z', id: r.zone.id }; if (window.innerWidth < 760) this.panel = null; } break; }
      case 'goto': { const z = s.zones.find((q) => q.id === v); if (z) { this.scene?.focusZone(z); this.sel = { kind: 'z', id: v }; if (window.innerWidth < 760) this.panel = null; } break; }
      case 'mold': { const b = s.buildings.find((q) => q.id === n); if (b) setMold(b); break; }
      case 'beltExt': this.res(callBeltService(sim, v)); break;
      case 'autoRaw': s.autoRaw = !s.autoRaw; break;
      case 'buyRaw': this.res(buy(sim, { [v]: 40 })); break;
      case 'buyOne': { const [k, q] = v.split(':'); this.res(buy(sim, { [k]: Number(q) })); break; }
      case 'buyKit': this.res(buy(sim, kitFor(n))); break;
      case 'autoBuy': s.autoBuy = !s.autoBuy; break;
      case 'autoShip': s.autoShip = !s.autoShip; break;
      case 'accept': this.res(acceptOffer(sim, n)); break;
      case 'decline': this.res(declineOffer(sim, n)); break;
      case 'ship': this.res(shipOrder(sim, n)); break;
      case 'spot': this.res(sellSpot(sim, n)); break;
      case 'hire': this.res(hire(sim, v)); break;
      case 'fire': this.res(fire(sim, n)); if (this.sel?.id === n) this.sel = null; break;
      case 'train': this.res(train(sim, n)); break;
      case 'repair': this.res(requestRepair(sim, s.buildings.find((b) => b.id === n))); break;
      case 'preventive': this.res(preventiveMaintenance(sim, s.buildings.find((b) => b.id === n))); break;
      case 'research': this.res(sim.startResearch(v)); break;
      case 'loan': this.res(takeLoan(sim, n)); break;
      case 'repay': this.res(repayLoan(sim, n)); break;
      case 'fintab': this.finTab = v; break;
      case 'save': this.autosave(); this.toast('good', 'Progresso salvo neste aparelho.'); break;
      case 'reset': this.confirmReset = true; break;
      case 'resetNo': this.confirmReset = false; break;
      case 'resetYes': clearSave(); window.onbeforeunload = null; this.autosave = () => {}; location.reload(); return;
      default:
    }
    this.refresh();
  }

  refresh() {
    this.renderHud(); this.renderBar(); this.renderPanel(); this.renderInfo();
    this.dom.rail.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.panel));
    this.dom.speed.querySelectorAll('[data-a=speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === this.sim.s.speed)));
    this.root.classList.toggle('paused', this.sim.s.speed === 0);
    this.drawCharts();
  }

  renderHud() {
    const s = this.sim.s;
    const ph = phaseInfo(s);
    const active = s.workers.filter((w) => w.state !== 'rest').length;
    const hour = GAME.startHour + (s.hourIndex || 0);
    const min = Math.floor(s.hourClock / GAME.hourSeconds * 60);
    const rate = s.rateHour || (s.hourClock > 5 ? s.hourNow.produced / (s.hourClock / GAME.hourSeconds) : 0);
    const stat = (l, v, cls = '') => `<div class="stat ${cls}"><span>${l}</span><b>${v}</b></div>`;
    const html = `<div class="brand"><strong>STIHL Factory Simulator</strong><small>Dia ${s.day} · ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} · Nível ${ph.index + 1}: ${ph.name}</small></div>
      <div class="stats">
        ${stat('Caixa', money(s.cash), s.cash < 0 ? 'neg' : 'cash')}
        ${stat('Produção/h', rate.toFixed(1).replace('.', ','))}
        ${stat('Funcionários ativos', `${active}/${s.workers.length}`)}
        ${stat('Pedidos pendentes', s.orders.length)}
        ${stat('Energia', `${Math.round(s.kw)} kW`)}
        ${stat('Eficiência (OEE)', pct(s.eff.oee), s.eff.oee < .4 && s.time > 60 ? 'warnv' : '')}
      </div>`;
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    if (!this.dom.hud.firstChild) this.dom.hud.innerHTML = html; else { const a = [...this.dom.hud.childNodes], b = [...tmp.childNodes]; b.forEach((n, i) => { if (a[i]) morph(a[i], n); else this.dom.hud.appendChild(n.cloneNode(true)); }); }
  }
  renderBar() {
    const v = this.building;
    if (!v) { this.dom.bar.hidden = true; return; }
    this.dom.bar.hidden = false;
    const name = v === 'remove' ? 'Removendo' : BUILDINGS[v].name;
    const dir = { E: '↘', S: '↙', W: '↖', N: '↗' }[this.scene?.layout.dir || 'E'];
    const html = `<b>${name}</b>${v === 'remove' ? '' : `<small>${money(BUILDINGS[v].cost)}</small>`}${v === 'belt' ? `<button data-a="rotate" aria-label="Girar">Girar ${dir}</button>` : ''}<button data-a="cancelBuild" class="primary">Concluir</button>`;
    const t = document.createElement('div'); t.innerHTML = html; this.syncChildren(this.dom.bar, t);
  }
  syncChildren(el, tmp) {
    const a = [...el.childNodes], b = [...tmp.childNodes];
    b.forEach((n, i) => { if (a[i]) morph(a[i], n); else el.appendChild(n.cloneNode(true)); });
    for (let i = b.length; i < a.length; i++) a[i].remove();
  }
  renderPanel() {
    const P = this.dom.panel;
    P.hidden = !this.panel;
    if (!this.panel) return;
    const m = MENUS.find((x) => x[0] === this.panel);
    this.dom.title.textContent = m[1];
    const t = document.createElement('div'); t.innerHTML = this[`p_${this.panel}`]();
    this.syncChildren(this.dom.body, t);
  }
  renderInfo() {
    const el = this.dom.info, sel = this.sel;
    let html = '';
    if (sel?.kind === 'b') html = this.infoBuilding();
    else if (sel?.kind === 'w') html = this.infoWorker();
    else if (sel?.kind === 'c') html = this.infoBelt();
    else if (sel?.kind === 'z') html = this.infoZone();
    el.hidden = !html;
    if (html) { const t = document.createElement('div'); t.innerHTML = html; this.syncChildren(el, t); }
  }

  // ---------- Janelas de seleção ----------
  infoBuilding() {
    const s = this.sim.s, b = this.selectedBuilding();
    if (!b) { this.sel = null; return ''; }
    const head = (title, sub) => `<header><div><h3>${title}</h3>${sub ? `<small>${sub}</small>` : ''}</div><button class="x" data-a="closeInfo" aria-label="Fechar">×</button></header>`;
    const def = STATION_STAGES[b.type];
    if (MACHINES[b.type]) return this.infoMachine(b, head);
    if (!def) {
      if (b.type === 'depot') return head('Depósito', 'Componentes') + row('Ocupação', `${stockUsed(s)} de ${depotCapacity(s)}`) + `<button data-a="menu" data-v="stock">Abrir estoque</button>`;
      if (b.type === 'dock') return head('Expedição', 'Motosserras prontas') + row('Prontas para envio', `${s.finished} de ${dockCapacity(s)}`) + `<button data-a="menu" data-v="log">Abrir pedidos</button>`;
      if (b.type === 'pallet') return head('Fim de linha', 'A empilhadeira leva para a expedição') + row('No pallet', `${b.count} de ${BUILDINGS.pallet.cap}`);
      if (BUILDINGS[b.type].front) {
        const k = truckAtBay(s, b.id);
        return head(BUILDINGS[b.type].name, BUILDINGS[b.type].desc) + `<div class="pill ${k ? 'warn' : 'ok'}">${k ? TRUCK_PHASE[k.phase] : 'Livre'}</div>` + row('Caminhões na fila', truckQueue(s));
      }
      return head(BUILDINGS[b.type].name, BUILDINGS[b.type].desc);
    }
    const [lbl, cls] = STATUS[b.status] || ['—', 'idle'];
    const op = s.workers.find((w) => w.id === b.operatorId);
    const total = b.t.run + b.t.starved + b.t.blocked + b.t.broken + b.t.absent;
    const repair = b.broken
      ? (b.externalRepair ? `<div class="pill warn">Serviço em andamento: ${Math.ceil(b.repairT)} s</div>` : b.techBy ? '<div class="pill warn">Técnico a caminho</div>' : `<button class="primary" data-a="repair" data-v="${b.id}">Chamar reparo (${money(REPAIR.externalCost)})</button>`)
      : `<button data-a="preventive" data-v="${b.id}">Manutenção preventiva (${money(REPAIR.preventiveCost)})</button>`;
    const hist = b.history.length ? `<details><summary>Histórico de reparos (${b.history.length})</summary>${b.history.map((h) => row(`Dia ${h.day} · ${h.kind}`, money(h.cost))).join('')}</details>` : '';
    return head(`${BUILDINGS[b.type].name}`, def.short)
      + `<div class="pill ${cls}">${lbl}</div>`
      + row('Produtividade', op ? pct(workerProductivity(op)) : '—')
      + row('Tempo de ciclo', `${cycleTime(this.sim, b).toFixed(1).replace('.', ',')} s`)
      + row('Disponível em operação', total > 0 ? pct(b.t.run / total) : '—')
      + row('Horas de funcionamento', b.hours.toFixed(1).replace('.', ','))
      + row('Chance de falha por hora', pct(failureChance(b)))
      + `<div class="row"><span>Desgaste</span><b class="${wearClass(b.wear)}">${Math.round(b.wear)}%</b></div>${meter(b.wear / 100, wearClass(b.wear))}`
      + row('Operador', op ? esc(op.name) : 'Nenhum')
      + repair + hist;
  }
  infoMachine(b, head) {
    const s = this.sim.s, d = MACHINES[b.type], [lbl, cls] = STATUS[b.status] || ['—', 'idle'];
    const op = s.workers.find((w) => w.id === b.operatorId);
    if (d.desk) return head(BUILDINGS.desk.name, SECTORS[b.dept].name) + `<div class="pill ${b.status === 'running' ? 'ok' : 'warn'}">${b.status === 'running' ? 'Efeito ativo' : 'Sem analista: efeito desligado'}</div>` + `<p class="hint">${SECTORS[b.dept].desc}</p>` + row('Analista', op ? esc(op.name) : 'Nenhum');
    const total = b.t.run + b.t.starved + b.t.blocked + b.t.broken + b.t.absent;
    const rec = d.in ? `${Object.entries(d.in).map(([k, q]) => `${q} ${COMPONENTS[k].name}`).join(' + ')} → ${COMPONENTS[moldOutput(b)].name}` : d.desc;
    const repair = b.broken
      ? (b.externalRepair ? `<div class="pill warn">Serviço em andamento: ${Math.ceil(b.repairT)} s</div>` : b.techBy ? '<div class="pill warn">Técnico atendendo</div>' : `<button class="primary" data-a="repair" data-v="${b.id}">Chamar serviço externo (${money(REPAIR.externalCost)})</button>`)
      : `<button data-a="preventive" data-v="${b.id}">Manutenção preventiva (${money(REPAIR.preventiveCost)})</button>`;
    return head(d.name, rec) + `<div class="pill ${cls}">${b.fault ? esc(b.fault.text) : lbl}</div>`
      + (d.heat ? row('Temperatura', `${Math.round(b.temp || 0)} °C`, (b.temp || 0) < 600 ? 'warn' : 'ok') : '')
      + (d.cycle ? row('Tempo de ciclo', `${machineCycle(this.sim, b).toFixed(1).replace('.', ',')} s`) : '')
      + row('Produtividade', op ? pct(workerProductivity(op)) : d.role === 'none' ? 'Automática' : '—')
      + row('Tempo produzindo', total > 0 ? pct(b.t.run / total) : '—')
      + (d.in ? row('Aprovadas / reprovadas', `${b.good} / ${b.bad}`) : '')
      + (d.in ? row('Na saída', `${b.out} de ${d.outCap}`) : '')
      + row('Horas de funcionamento', b.hours.toFixed(1).replace('.', ','))
      + `<div class="row"><span>Desgaste</span><b class="${wearClass(b.wear)}">${Math.round(b.wear)}%</b></div>${meter(b.wear / 100, wearClass(b.wear))}`
      + row('Operador', op ? esc(op.name) : d.role === 'none' ? 'Não precisa' : 'Nenhum')
      + (b.type === 'injetora' ? `<button data-a="mold" data-v="${b.id}">Trocar molde (agora: ${COMPONENTS[moldOutput(b)].name})</button>` : '') + repair;
  }
  infoZone() {
    const s = this.sim.s, z = s.zones.find((q) => q.id === this.sel.id);
    if (!z) { this.sel = null; return ''; }
    const sec = z.sector || z.id, e = sectorEfficiency(s).find((x) => x.z === z);
    const dept = DEPARTMENTS[sec];
    return `<header><div><h3>${esc(z.name)}</h3><small>${SECTORS[sec].desc}</small></div><button class="x" data-a="closeInfo" aria-label="Fechar">×</button></header>`
      + (dept ? `<div class="pill ${deptActive(s, sec) ? 'ok' : 'warn'}">${deptActive(s, sec) ? 'Efeito ativo' : 'Contrate um analista em Funcionários'}</div>` : '')
      + (e ? row('Máquinas', e.count) + row('Eficiência', pct(e.eff)) + row('Aprovadas / reprovadas', `${e.good} / ${e.bad}`) + row('Paradas agora', e.stopped, e.stopped ? 'bad' : '') : (dept ? '' : '<p class="hint">Prédio vazio. Abra Construção e instale as máquinas.</p>'))
      + row('Tamanho', `${z.w} × ${z.h} células`) + (z.waste !== undefined ? row('Resíduos', `${Math.round(z.waste)}%`, z.waste > 75 ? 'warn' : '') : '')
      + `<button data-a="expand" data-v="${z.id}">Ampliar (${money(GAME.expansionCost)})</button>`;
  }
  infoWorker() {
    const s = this.sim.s, w = s.workers.find((x) => x.id === this.sel.id);
    if (!w) { this.sel = null; return ''; }
    return `<header><div><h3>${esc(w.name)}</h3><small>${ROLES[w.role].name}</small></div><button class="x" data-a="closeInfo" aria-label="Fechar">×</button></header>`
      + `<div class="pill ${w.state === 'rest' ? 'warn' : 'ok'}">${WSTATE[w.state] || w.state}</div>${this.workerStats(w)}`;
  }
  workerStats(w) {
    return row('Salário por dia', money(w.salary)) + row('Experiência', `${(w.xp / 45).toFixed(0)} h`) + row('Produtividade', pct(workerProductivity(w))) + row('Treinamento', `Nível ${w.train}`)
      + `<div class="row"><span>Fadiga</span><b>${pct(w.fatigue)}</b></div>${meter(w.fatigue, w.fatigue > .75 ? 'warn' : 'ok')}`
      + `<div class="btns"><button data-a="train" data-v="${w.id}">Treinar (${money(trainCost(w))})</button><button class="ghost" data-a="fire" data-v="${w.id}">Desligar</button></div>`;
  }
  infoBelt() {
    const c = beltAt(this.sim.s, this.sel.x, this.sel.y);
    if (!c) { this.sel = null; return ''; }
    const stuck = c.items.length && c.items[0].p >= 1;
    return `<header><div><h3>${BUILDINGS[c.kind].name}</h3><small>Célula ${c.x}, ${c.y}</small></div><button class="x" data-a="closeInfo" aria-label="Fechar">×</button></header>`
      + `<div class="pill ${stuck ? 'warn' : 'ok'}">${stuck ? 'Fila parada' : 'Em movimento'}</div>` + row('Peças nesta célula', c.items.length);
  }

  // ---------- Painéis ----------
  p_build() {
    const s = this.sim.s;
    const built = new Set(s.zones.map((z) => z.sector || z.id));
    const groups = [];
    for (const sec of Object.keys(SECTORS)) {
      if (!built.has(sec) || DEPARTMENTS[sec]) continue;
      const list = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].zone === sec && !MACHINES[k]?.internal);
      if (list.length) groups.push([SECTORS[sec].name, list]);
    }
    groups.push(['Qualquer lugar', ['belt', 'split', 'rest']]);
    return groups.map(([g, list]) => `<h4>${g}</h4><div class="cards">${list.map((k) => {
      const d = BUILDINGS[k];
      return `<button class="card ${this.building === k ? 'sel' : ''}" data-a="build" data-v="${k}" ${s.cash < d.cost ? 'data-poor="1"' : ''}><b>${d.name}</b><small>${d.desc}</small><em>${money(d.cost)}</em></button>`;
    }).join('')}</div>`).join('')
      + `<h4>Ampliar prédios (${money(GAME.expansionCost)} por 4 colunas)</h4><div class="btns">${s.zones.map((z) => `<button data-a="expand" data-v="${z.id}">${z.name} (${z.w} × ${z.h})</button>`).join('')}</div><div class="btns"><button class="ghost" data-a="removeMode">Remover</button></div><p class="hint">Novos setores aparecem aqui depois de construídos em Complexo.</p>`;
  }
  p_complex() {
    const s = this.sim.s, built = new Set(s.zones.map((z) => z.sector || z.id)), lots = freeLots(s).length;
    const card = (k) => { const d = SECTORS[k]; return `<button class="card ${built.has(k) ? 'sel' : ''}" data-a="buySector" data-v="${k}" ${s.cash < d.cost ? 'data-poor="1"' : ''}><b>${String(d.num).padStart(2, '0')} · ${d.name}</b><small>${d.desc}</small><em>${money(d.cost)}</em></button>`; };
    const prod = ['fundicao', 'usinagem', 'cilindros', 'cromagem', 'brunimento', 'injecao', 'motores', 'embalagem', 'prod', 'almox', 'log'];
    return `${row('Prédios', s.zones.length)}${row('Terrenos livres', lots)}
      <h4>Seus prédios</h4><div class="line">${s.zones.map((z) => { const d = DEPARTMENTS[z.sector]; return `<button class="lineitem" data-a="goto" data-v="${z.id}"><span class="dot ${d && !deptActive(s, z.sector) ? 'warn' : 'ok'}"></span><span><b>${esc(z.name)}</b><small>Entrar no prédio</small></span></button>`; }).join('')}</div>
      <h4>Cadeia de fabricação</h4><p class="hint">Recebimento → Fundição → Usinagem → Cilindros → Cromagem → Brunimento → Motores → Montagem final → Embalagem → Expedição. Plásticos seguem em paralelo. O que você não fabrica continua sendo comprado.</p>
      <h4>Setores de produção</h4><div class="cards">${prod.map(card).join('')}</div>
      <h4>Departamentos de apoio</h4><div class="cards">${Object.keys(DEPARTMENTS).map(card).join('')}</div>
      <p class="hint">Cada departamento só tem efeito com um analista contratado. Os números dos prédios são ambientação, não um cadastro oficial.</p>`;
  }
  p_prod() {
    const s = this.sim.s, st = s.buildings.filter((b) => STATION_STAGES[b.type]), bn = findBottleneck(s), ph = phaseInfo(s), m = MODELS['MS 170'];
    const cost = unitCost();
    return `<h4>Modelo em produção</h4><div class="model"><b>MS 170</b><small>Referência de produto. Valores fictícios.</small>
        ${row('Custo de componentes', money(cost))}${row('Preço de tabela', money(m.price))}${row('Margem bruta', pct((m.price - cost) / m.price))}${row('Componentes', m.parts)}</div>
      <h4>Linha de montagem</h4><div class="line">${st.map((b) => {
      const [l, c] = STATUS[b.status]; const total = b.t.run + b.t.starved + b.t.blocked + b.t.broken + b.t.absent;
      return `<button class="lineitem" data-a="sel" data-v="${b.id}"><span class="dot ${c}"></span><span><b>${BUILDINGS[b.type].name}${bn?.id === b.id ? ' <i class="tag">gargalo</i>' : ''}</b><small>${l}</small></span><span class="num">${total > 0 ? pct(b.t.run / total) : '—'}</span></button>`;
    }).join('')}</div>
      <h4>Indicadores OEE</h4>${row('Disponibilidade', pct(s.eff.avail))}${row('Desempenho', pct(s.eff.perf))}${row('Qualidade', pct(s.eff.qual))}${row('OEE', pct(s.eff.oee))}
      <h4>Controle de produção</h4>${this.control()}
      <h4>Totais</h4>${row('Motosserras prontas', s.stats.produced)}${row('Vendidas', s.stats.sold)}${row('Refugo', s.stats.scrapped)}${row('Retrabalho', s.stats.reworked)}
      <h4>Evolução da fábrica</h4><div class="phases">${PHASES.map((p, i) => `<div class="phase ${i === ph.index ? 'now' : i < ph.index ? 'done' : ''}"><b>${i + 1}. ${p.name}</b><small>${p.text}</small></div>`).join('')}</div>
      ${ph.goal !== Infinity ? `<p class="hint">Faltam ${ph.goal - s.stats.sold} vendas para o próximo nível. As novas tecnologias de cada nível chegam nas próximas versões.</p>` : ''}
      <h4>Próximos modelos</h4>${Object.entries(MODELS).filter(([, x]) => !x.unlocked).map(([n, x]) => row(n, `${money(x.price)} · em breve`)).join('')}`;
  }
  control() {
    const s = this.sim.s, ms = s.buildings.filter((b) => b.t && b.type !== 'desk');
    const good = ms.reduce((a, b) => a + b.good, 0), bad = ms.reduce((a, b) => a + b.bad, 0);
    const d = s.days[s.days.length - 1], base = d || s.today, costs = d ? d.expense - d.build : base.parts + base.wages + base.energy + base.maint + base.other;
    const unit = base.produced ? costs / base.produced : 0, avg = s.stats.sold ? s.stats.revenue / s.stats.sold : 0;
    const rows = sectorEfficiency(s).map((e) => row(esc(e.z.name.replace(/^Prédio \S+ · /, '')), pct(e.eff))).join('');
    return row('Produção por hora', s.rateHour) + row('Produção no turno de hoje', s.today.produced) + row('Último dia fechado', d ? d.produced : '—')
      + row('Peças aprovadas', good) + row('Peças reprovadas', bad, bad ? 'warn' : '') + row('Máquinas paradas', ms.filter((b) => b.broken).length, ms.some((b) => b.broken) ? 'bad' : '')
      + row('Custo por motosserra', unit ? money(unit) : '—') + row('Lucro por motosserra', unit && avg ? money(avg - unit) : '—')
      + `<h4>Eficiência por setor</h4>${rows}`;
  }
  p_staff() {
    const s = this.sim.s;
    const hireBtns = Object.entries(ROLES).map(([k, r]) => `<button class="card" data-a="hire" data-v="${k}"><b>${r.name}</b><small>${money(r.salary)} por dia</small><em>Contratar por ${money(r.hireCost * this.sim.fx.hire)}</em></button>`).join('');
    return `<h4>Equipe (${s.workers.length})</h4><div class="people">${s.workers.map((w) => `<details class="person"><summary><span class="dot ${w.state === 'rest' ? 'warn' : 'ok'}"></span><span><b>${esc(w.name)}</b><small>${ROLES[w.role].name} · ${WSTATE[w.state] || w.state}</small></span><span class="num">${pct(w.fatigue)}</span></summary>${this.workerStats(w)}</details>`).join('')}</div>
      <h4>Contratar</h4><div class="cards">${hireBtns}</div>
      <p class="hint">Fadiga: o funcionário rende menos conforme cansa e vai à área de descanso ao chegar em 92%. Cada máquina precisa de um operador e cada departamento, de um analista. Técnicos atendem os chamados sozinhos.</p>`;
  }
  p_stock() {
    const s = this.sim.s, used = stockUsed(s), cap = depotCapacity(s);
    return `<div class="row"><span>Ocupação do depósito</span><b>${used} de ${cap}</b></div>${meter(used / cap, used / cap > .9 ? 'warn' : 'ok')}
      ${incoming(s) ? row('A caminho', `${incoming(s)} unidades`) : ''}
      <h4>Comprar kits completos</h4><div class="btns"><button class="primary" data-a="buyKit" data-v="10">10 motosserras (${money(unitCost() * 10 + GAME.freightIn)})</button><button data-a="buyKit" data-v="25">25 (${money(unitCost() * 25 + GAME.freightIn)})</button></div>
      <label class="toggle"><button role="switch" aria-checked="${s.autoBuy}" data-a="autoBuy"></button><span>Comprar automaticamente 25 kits quando algo estiver acabando</span></label>
      <h4>Componentes</h4><div class="stock">${Object.entries(COMPONENTS).filter(([, c]) => !c.raw && !c.made).map(([k, c]) => `<div class="stockrow"><i style="background:${c.color}"></i><span><b>${c.name}</b><small>${money(c.price)} cada</small></span><span class="num ${s.stock[k] < 6 ? 'warnv' : ''}">${s.stock[k]}</span><button data-a="buyOne" data-v="${k}:10">+10</button></div>`).join('')}</div>
      <h4>Matérias-primas</h4><div class="stock">${Object.entries(COMPONENTS).filter(([, c]) => c.raw).map(([k, c]) => `<div class="stockrow"><i style="background:${c.color}"></i><span><b>${c.name}</b><small>${money(c.price * this.sim.fx.price)} cada</small></span><span class="num">${s.stock[k] || 0}</span><button data-a="buyRaw" data-v="${k}">+40</button></div>`).join('')}</div>
      ${this.sim.fx.pcp ? `<label class="toggle"><button role="switch" aria-checked="${!!s.autoRaw}" data-a="autoRaw"></button><span>PCP: repor matéria-prima automaticamente</span></label>` : '<p class="hint">O departamento de PCP libera a reposição automática de matéria-prima.</p>'}
      <h4>Peças em processo</h4><div class="stock">${Object.entries(COMPONENTS).filter(([, c]) => c.made).map(([k, c]) => `<div class="stockrow"><i style="background:${c.color}"></i><span><b>${c.name}</b></span><span class="num">${s.stock[k] || 0}</span></div>`).join('')}</div>
      <p class="hint">Cada compra paga ${money(GAME.freightIn)} de frete e entra pela doca de recebimento. Se a doca estiver ocupada, o caminhão espera na fila.</p>`;
  }
  p_log() {
    const s = this.sim.s, L = logisticsSummary(s);
    const offer = (o) => `<div class="order"><div><b>${esc(o.client)}</b>${o.urgent ? '<i class="tag">urgente</i>' : ''}${o.export ? '<i class="tag blue">exportação</i>' : ''}<small>${o.qty} MS 170 · ${money(o.unit)} cada · prazo ${o.hours} h</small><small class="value">${money(o.qty * o.unit)} · expira em ${Math.ceil(o.ttl)} s</small></div><div class="btns"><button class="primary" data-a="accept" data-v="${o.id}">Aceitar</button><button class="ghost" data-a="decline" data-v="${o.id}">Recusar</button></div></div>`;
    const order = (o) => `<div class="order"><div><b>${esc(o.client)}</b><small>${o.shipped} de ${o.qty} enviadas · ${money(o.unit)} cada</small><small class="value ${o.deadline < 60 ? 'warnv' : ''}">Prazo: ${(o.deadline / GAME.hourSeconds).toFixed(1).replace('.', ',')} h</small></div><div class="btns"><button data-a="ship" data-v="${o.id}">Enviar agora</button></div></div>`;
    return `${row('Prontas na expedição', `${s.finished} de ${dockCapacity(s)}`)}
      <h4>Pedidos aceitos (${s.orders.length})</h4>${s.orders.map(order).join('') || '<p class="hint">Nenhum pedido em andamento.</p>'}
      <label class="toggle"><button role="switch" aria-checked="${s.autoShip}" data-a="autoShip"></button><span>Enviar pedidos automaticamente quando estiverem prontos</span></label>
      <h4>Novas propostas (${s.offers.length})</h4>${s.offers.map(offer).join('') || '<p class="hint">Novas propostas chegam a cada minuto.</p>'}
      <h4>Venda no mercado</h4>${row('Preço atual', money(spotPrice(s)))}<div class="btns"><button data-a="spot" data-v="5">Vender 5</button><button data-a="spot" data-v="20">Vender 20</button></div><p class="hint">Cada unidade vendida reduz o preço do mercado, que se recupera com o tempo.</p>
      <h4>Docas</h4>${s.buildings.filter((b) => BUILDINGS[b.type].front).map((b) => { const k = truckAtBay(s, b.id); return row(BUILDINGS[b.type].name, k ? TRUCK_PHASE[k.phase] : 'Livre', k ? 'warn' : 'ok'); }).join('')}${row('Caminhões na fila', truckQueue(s), truckQueue(s) ? 'warn' : '')}
      <h4>Em transporte (${s.shipments.length})</h4>${s.shipments.map((x) => row(`${esc(x.label)}: ${x.qty} un.`, money(x.value))).join('') || '<p class="hint">Nenhuma carga na estrada.</p>'}
      <h4>Esteiras</h4>${row('Células', L.cells)}${row('Peças em circulação', L.items)}${row('Filas paradas', L.stuck, L.stuck > 3 ? 'warn' : '')}${row('Reputação', `${Math.round(s.reputation)}/100`)}`;
  }
  p_maint() {
    const s = this.sim.s, st = s.buildings.filter((b) => b.t && b.type !== 'desk');
    const tk = openTickets(s);
    const ticket = (x) => `<div class="order"><div><b>${esc(x.text)}</b><i class="tag ${x.kind === 'it' ? 'blue' : ''}">${x.kind === 'it' ? 'TI' : 'manutenção'}</i><small>${esc(x.place)} · aberto há ${Math.round(x.age)} s</small></div>${x.ext ? `<div class="pill warn">Serviço externo: ${Math.ceil(x.repairT)} s</div>` : x.tech ? '<div class="pill warn">Técnico atendendo</div>' : `<div class="btns"><button class="primary" data-a="${x.type === 'b' ? 'repair' : 'beltExt'}" data-v="${x.id}">Chamar serviço externo (${money(x.type === 'b' ? REPAIR.externalCost : 600)})</button></div>`}</div>`;
    return `<h4>Chamados abertos (${tk.length})</h4>${tk.map(ticket).join('') || '<p class="hint">Nenhum chamado aberto.</p>'}<h4>Equipamentos</h4>` + st.map((b) => {
      const hist = b.history.slice(0, 3).map((h) => row(`Dia ${h.day} · ${h.kind}`, money(h.cost))).join('');
      return `<div class="machine"><div class="row"><b>${BUILDINGS[b.type].name}</b><b class="${wearClass(b.wear)}">${b.broken ? 'Parada' : `${Math.round(b.wear)}%`}</b></div>${meter(b.wear / 100, wearClass(b.wear))}
        ${row('Horas de funcionamento', b.hours.toFixed(1).replace('.', ','))}${row('Chance de falha por hora', pct(failureChance(b)))}${hist}
        ${b.broken ? (b.externalRepair ? `<div class="pill warn">Serviço: ${Math.ceil(b.repairT)} s</div>` : b.techBy ? '<div class="pill warn">Técnico a caminho</div>' : `<button class="primary" data-a="repair" data-v="${b.id}">Chamar reparo (${money(REPAIR.externalCost)})</button>`) : `<button data-a="preventive" data-v="${b.id}">Preventiva (${money(REPAIR.preventiveCost)})</button>`}</div>`;
    }).join('') + '<p class="hint">Uma máquina quebrada para a estação até o reparo. Técnicos de manutenção e de TI vão até o local, diagnosticam e reparam. O técnico de TI exige o prédio de TI.</p>';
  }
  p_res() {
    const r = this.sim.s.research;
    return Object.entries(RESEARCH).map(([k, x]) => {
      const done = r.done[k], act = r.active?.id === k;
      return `<div class="machine"><div class="row"><b>${x.name}</b>${done ? '<b class="ok">Concluída</b>' : ''}</div><small>${x.desc}</small>
       ${act ? `${meter(1 - r.active.t / x.seconds, 'ok')}<small>Faltam ${Math.ceil(r.active.t)} s</small>` : done ? '' : `<button data-a="research" data-v="${k}" ${r.active ? 'disabled' : ''}>Pesquisar por ${money(x.cost)}</button>`}</div>`;
    }).join('');
  }
  p_fin() {
    const s = this.sim.s, t = s.today;
    const exp = t.parts + t.wages + t.energy + t.maint + t.build + t.other;
    const tabs = [['prod', 'Produtividade'], ['fat', 'Faturamento'], ['desp', 'Despesas'], ['efi', 'Eficiência']];
    const days = s.days.slice(-6).reverse();
    return `<div class="fin-top"><div><small>Caixa</small><b class="${s.cash < 0 ? 'bad' : ''}">${money(s.cash)}</b></div><div><small>Resultado hoje</small><b class="${t.revenue - exp < 0 ? 'bad' : 'ok'}">${money(t.revenue - exp)}</b></div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${this.finTab === k}" data-a="fintab" data-v="${k}">${l}</button>`).join('')}</div>
      <canvas id="chart" class="chart" aria-label="Gráfico de ${tabs.find((x) => x[0] === this.finTab)[1]}"></canvas>
      <h4>Fluxo de caixa de hoje</h4>${row('Vendas', money(t.revenue), 'ok')}${row('Componentes', `− ${money(t.parts)}`)}${row('Salários (no fim do dia)', `− ${money(t.wages)}`)}${row('Energia (no fim do dia)', `− ${money(t.energy)}`)}${row('Manutenção', `− ${money(t.maint)}`)}${row('Construção', `− ${money(t.build)}`)}${row('Outros, frete e multas', `− ${money(t.other)}`)}
      <h4>Dias fechados</h4>${days.length ? `<div class="scrollx"><table><thead><tr><th>Dia</th><th>Prod.</th><th>Receita</th><th>Despesa</th><th>Resultado</th></tr></thead><tbody>${days.map((d) => `<tr><td>${d.day}</td><td>${d.produced}</td><td>${money(d.revenue)}</td><td>${money(d.expense)}</td><td class="${d.profit < 0 ? 'bad' : 'ok'}">${money(d.profit)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">O primeiro dia fecha após 8 horas de jogo (6 minutos em 1x).</p>'}
      <h4>Empréstimos</h4>${row('Dívida', money(s.loan))}<div class="btns"><button data-a="loan" data-v="100000">Pegar R$ 100.000</button><button class="ghost" data-a="repay" data-v="100000">Pagar R$ 100.000</button></div><p class="hint">Juros de 0,8% ao dia sobre a dívida. Limite de R$ 600.000.</p>
      <h4>Partida</h4><div class="btns"><button data-a="save">Salvar agora</button>${this.confirmReset ? '<button class="danger" data-a="resetYes">Apagar tudo</button><button class="ghost" data-a="resetNo">Cancelar</button>' : '<button class="ghost" data-a="reset">Novo jogo</button>'}</div>
      <p class="hint">O jogo salva sozinho neste aparelho a cada 20 s. Versão ${GAME.version}.</p>`;
  }
  drawCharts() {
    if (this.panel !== 'fin') return;
    const c = this.dom.body.querySelector('#chart'); if (!c) return;
    const h = this.sim.s.hours;
    const css = getComputedStyle(c), a = css.getPropertyValue('--accent').trim(), o = css.getPropertyValue('--good').trim(), r = css.getPropertyValue('--bad').trim();
    const map = {
      prod: [[{ data: h.map((x) => x.produced), color: a }], { bars: true }],
      fat: [[{ data: h.map((x) => x.revenue), color: o }], {}],
      desp: [[{ data: h.map((x) => x.expense), color: r }], {}],
      efi: [[{ data: h.map((x) => x.oee), color: a }], { pct: true, max: 1 }],
    };
    drawChart(c, ...map[this.finTab]);
  }
}
