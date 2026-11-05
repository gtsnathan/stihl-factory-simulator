// Execute com: node tests/sim.test.mjs
import assert from 'node:assert';
import { Simulation } from '../public/js/core/sim.js';
import { newGame } from '../public/js/core/state.js';
import { kitFor, buy, stockUsed } from '../public/js/systems/inventory.js';
import { acceptOffer, sellSpot } from '../public/js/systems/economy.js';
import { requestRepair } from '../public/js/systems/machines.js';
import { hire } from '../public/js/systems/workers.js';
import { GAME, MACHINES } from '../public/js/config.js';
import { buyBuilding, placeInZone, raiseIncident, openTickets, callBeltService } from '../public/js/systems/sectors.js';
import { findPath } from '../public/js/core/grid.js';

const run = (sim, sec) => { for (let i = 0; i < sec / GAME.tick; i++) sim.step(GAME.tick); };
const partsTotal = (s) => {
  let n = stockUsed(s);
  for (const b of s.buildings) if (b.buffer) n += Object.values(b.buffer).reduce((a, c) => a + c, 0);
  for (const w of s.workers) if (w.carry) n += Object.values(w.carry).reduce((a, c) => a + c, 0);
  return n;
};

// 1. Produção contínua com contabilidade real
{
  const sim = new Simulation(newGame(7)); const s = sim.s;
  const start = partsTotal(s);
  run(sim, 90);
  assert(s.stats.produced >= 1, 'produz motosserras em 90 s');
  assert(partsTotal(s) < start, 'consome componentes');
  assert(s.workers.every((w) => Number.isFinite(w.x) && Number.isFinite(w.y)), 'posições válidas');
  console.log('90 s →', s.stats.produced, 'prontas; expedição', s.finished);
}

// 2. Dez dias com compra automática: gera lucro e não trava
{
  const sim = new Simulation(newGame(11)); const s = sim.s;
  s.autoBuy = true; const cash0 = s.cash;
  sim.on('breakdown', () => {});
  for (let t = 0; t < GAME.hourSeconds * GAME.shiftHours * 10; t += 1) {
    run(sim, 1);
    const backlog = s.orders.reduce((a, o) => a + o.qty - o.shipped, 0);
    for (const o of [...s.offers]) if (backlog + o.qty < 14) acceptOffer(sim, o.id);
    for (const b of s.buildings) if (b.broken && !b.externalRepair) requestRepair(sim, b);
    for (const k in s.belts) if (s.belts[k].jam && !(s.belts[k].jamT > 0)) callBeltService(sim, k);
    if (s.finished > 40) sellSpot(sim, 10);
  }
  console.log(`10 dias → prod ${s.stats.produced} vend ${s.stats.sold} refugo ${s.stats.scrapped} retrab ${s.stats.reworked} caixa ${Math.round(s.cash)} OEE ${(s.eff.oee * 100).toFixed(1)}%`);
  console.table(s.buildings.filter((b) => b.t).map((b) => ({ tipo: b.type, ...Object.fromEntries(Object.entries(b.t).map(([k, v]) => [k, Math.round(v)])), rep: b.history.length })));
  console.table(s.days.map((d) => ({ dia: d.day, prod: d.produced, rec: Math.round(d.revenue), desp: Math.round(d.expense), res: Math.round(d.profit) })));
  assert(s.stats.produced > 100, 'produção consistente');
  assert(s.cash > cash0, 'a fábrica fica lucrativa');
  assert(s.stats.scrapped + s.stats.reworked > 0, 'defeitos acontecem');
}

// 3. Bloqueio real: sem esvaziar o fim da linha, a linha para por gargalo
{
  const sim = new Simulation(newGame(3)); const s = sim.s;
  s.workers = s.workers.filter((w) => w.role !== 'fork');
  run(sim, 400);
  const st3 = s.buildings.find((b) => b.type === 'st3');
  assert.equal(s.buildings.find((b) => b.type === 'pallet').count, 6, 'pallet lotado');
  assert(st3.t.blocked > 0, 'estação 3 fica bloqueada');
}

// 4. Quebra para a estação até o reparo
{
  const sim = new Simulation(newGame(5)); const s = sim.s;
  const st = s.buildings.find((b) => b.type === 'st1');
  run(sim, 20); st.wear = 100; run(sim, 2);
  assert(st.broken, 'quebrou'); const prog = st.done;
  run(sim, 20); assert.equal(st.done, prog, 'não produz quebrada');
  assert(requestRepair(sim, st).ok); run(sim, 32);
  assert(!st.broken && st.wear < 1 && st.history.length === 1, 'reparo registrado');
}

// 5. Depósito limitado e compra
{
  const sim = new Simulation(newGame(9));
  assert(!buy(sim, { parafusos: 9999 }).ok, 'capacidade do depósito é respeitada');
  assert(buy(sim, kitFor(10)).ok); const before = stockUsed(sim.s); run(sim, 30);
  assert(stockUsed(sim.s) !== before, 'entrega chega');
}

// 5b. Docas: caminhão entra, ocupa a vaga e o segundo espera na fila
{
  const sim = new Simulation(newGame(14)); const s = sim.s;
  assert(buy(sim, { parafusos: 10 }).ok); assert(buy(sim, { parafusos: 10 }).ok);
  const bay = s.buildings.find((b) => b.type === 'bayIn'); const seen = new Set(); let maxBusy = 0;
  for (let i = 0; i < 60 * 30; i++) {
    sim.step(GAME.tick); s.trucks.forEach((k) => seen.add(k.phase));
    maxBusy = Math.max(maxBusy, s.trucks.filter((k) => k.bay === bay.id).length);
  }
  assert(['approach', 'enter', 'work', 'exit', 'leave'].every((p) => seen.has(p)), 'caminhão faz todo o trajeto');
  assert.equal(maxBusy, 1, 'uma doca atende um caminhão por vez');
  assert.equal(s.deliveries.length, 0, 'as duas entregas foram descarregadas');
  assert.equal(s.trucks.length, 0, 'caminhões foram embora');
  assert(!sim.build('bayIn', 3, 20).ok, 'doca precisa encostar na parede frontal');
  assert(!sim.remove(bay.x, bay.y).ok, 'não remove a única doca');
  // Save antigo ganha docas
  const old = JSON.parse(JSON.stringify(newGame(15))); delete old.trucks; delete old.zones; old.cash = 123456; old.day = 9;
  const m = new Simulation(old); assert.equal(m.s.buildings.filter((b) => b.type.startsWith('bay')).length, 2, 'migração cria docas');
  assert(m.s.zones.length === 3 && m.s.day === 9 && m.s.cash === 123456, 'migração mantém o progresso');
  run(m, 5);
  // Paredes: o caminho do depósito à produção passa pela porta
  const pth = findPath(m.s, 2, 31, 3, 22); assert(pth && pth.some((c) => c.x === 5 && c.y === 27) && pth.some((c) => c.x === 5 && c.y === 24), 'atravessa pelas portas');
  assert(!findPath(m.s, 21, 26, 21, 23).some((c, i, a) => i && a[i - 1].y === 25 && c.y === 24 && c.x !== 5 && c.x !== 17), 'não atravessa parede');
  // Ampliação
  const e = new Simulation(newGame(16)); assert(e.expandZone('prod').ok); assert(e.expandZone('almox').ok); assert(!e.expandZone('almox').ok, 'almoxarifado encontra a logística');
}

// 6. Construção, esteira ligada e técnico em nova estação
{
  const sim = new Simulation(newGame(12));
  assert(!sim.build('st1', 2, 20).ok, 'célula ocupada');
  assert(!sim.build('st1', 2, 29).ok, 'estação só no prédio de produção');
  assert(!sim.build('depot', 10, 18).ok, 'depósito só no almoxarifado');
  assert(sim.build('st1', 2, 18).ok); assert(sim.build('belt', 4, 19, 'E').ok);
  assert(hire(sim, 'assembler').ok); assert(hire(sim, 'tech').ok);
  run(sim, 30);
  const novo = sim.s.buildings.find((b) => b.type === 'st1' && b.y === 18);
  assert(novo.operatorId, 'nova estação recebe montador');
}

// 7. Salvamento: JSON completo continua rodando igual
{
  const a = new Simulation(newGame(21)); run(a, 60);
  const b = new Simulation(JSON.parse(JSON.stringify(a.s)));
  run(a, 60); run(b, 60);
  assert.equal(a.s.stats.produced, b.s.stats.produced, 'save restaura a simulação');
  assert.equal(Math.round(a.s.cash), Math.round(b.s.cash));
}

// 8. Independente da taxa de quadros
{
  const a = new Simulation(newGame(33)), b = new Simulation(newGame(33));
  for (let i = 0; i < 3000; i++) a.advance(1 / 60);
  for (let i = 0; i < 1500; i++) b.advance(1 / 30);
  assert(Math.abs(a.s.time - b.s.time) < .1);
  assert.equal(a.s.stats.produced, b.s.stats.produced, 'mesmo resultado a 60 e 30 FPS');
}
// 9. Cadeia completa: matéria-prima vira motor próprio, sem comprar o kit do motor
{
  const sim = new Simulation(newGame(41)); const s = sim.s; s.cash = 3e6;
  const put = (sector, types) => { const r = buyBuilding(sim, sector); assert(r.ok, sector); for (const t of types) { const p = placeInZone(s, t, r.zone); assert(p, t); const b = sim.build(t, p.x, p.y); assert(b.ok, `${t}: ${b.msg}`); assert(hire(sim, MACHINES[t].role === 'none' ? 'stock' : 'assembler').ok); } return r.zone; };
  put('fundicao', ['forno', 'diecast']); put('usinagem', ['cnc', 'torno', 'fresa']); put('cilindros', ['acab']);
  const crom = put('cromagem', ['tanque', 'residuo']); put('brunimento', ['brunidora']);
  const inj = put('injecao', ['injetora', 'injetora']); put('motores', ['bancada']);
  s.buildings.filter((b) => b.type === 'injetora')[1].mold = 'tampa';
  for (let i = 0; i < 6; i++) hire(sim, 'stock');
  hire(sim, 'tech');
  s.stock.motor = 0; s.autoBuy = false;
  for (const k of ['aluminio', 'aco', 'plastico', 'quimico']) s.stock[k] = 90;
  const lim = s.buildings.filter((b) => b.type === 'depot'); assert(lim.length === 1);
  assert(s.zones.length === 10);
  const motors0 = s.stock.motor;
  run(sim, 900);
  const made = s.stock.motor + s.buildings.filter((b) => b.type === 'st1').reduce((a, b) => a + (b.buffer.motor || 0), 0);
  console.log('Cadeia em 900 s:', { motor: s.stock.motor, feitos: s.stats.made, cil: s.stock.cilindro, aluminio: s.stock.aluminio, resid: Math.round(crom.waste || 0), status: s.buildings.filter((b) => MACHINES[b.type]).map((b) => `${b.type}:${b.status}`).join(' ') });
  assert(s.buildings.find((b) => b.type === 'bancada').done > 0 || made > motors0, 'motor próprio foi produzido');
  assert(s.stock.aluminio < 90 && s.stock.quimico < 90, 'matéria-prima é consumida');
  // Sem forno quente a fundição para
  const cold = new Simulation(newGame(42)); cold.s.cash = 1e6; const z = buyBuilding(cold, 'fundicao').zone; const p = placeInZone(cold.s, 'diecast', z); cold.build('diecast', p.x, p.y); hire(cold, 'assembler'); cold.s.stock.aluminio = 20; hire(cold, 'stock'); run(cold, 60);
  assert.equal(cold.s.buildings.find((b) => b.type === 'diecast').status, 'cold', 'fundição sem forno fica parada');
}

// 10. Departamento só vale com analista e tem efeito medido
{
  const a = new Simulation(newGame(50)); a.s.cash = 1e6;
  assert(!hire(a, 'it').ok, 'técnico de TI exige o prédio de TI');
  buyBuilding(a, 'compras'); const before = a.fx.price; run(a, 2); assert.equal(a.fx.price, 1, 'sem analista não há efeito');
  assert(hire(a, 'office').ok); run(a, 60); assert(a.fx.price < before, 'com analista o desconto vale');
}

// 11. Chamado de TI: o técnico vai ao local e resolve; manutenção não atende
{
  const a = new Simulation(newGame(60)); const s = a.s; s.cash = 1e6;
  buyBuilding(a, 'ti'); hire(a, 'office'); run(a, 60); assert(hire(a, 'it').ok, 'contrata técnico de TI');
  hire(a, 'tech');
  const b = raiseIncident(a, { kind: 'it', text: 'Impressora Zebra sem imprimir', types: ['st3'] });
  assert(b.broken && openTickets(s).length === 1, 'chamado aberto');
  const done0 = b.done; run(a, 6); assert.equal(b.done, done0, 'parada durante o chamado');
  run(a, 90); assert(!b.broken && !b.fault && b.history[0].kind.includes('Zebra'), 'chamado resolvido');
  const c = raiseIncident(a, { kind: 'maint', text: 'Esteira travada', belt: true }); assert(c.jam); run(a, 60); assert(!c.jam, 'técnico libera a esteira');
}

// 12. Migração da versão com três prédios mantém tudo e desloca a fábrica
{
  const old = JSON.parse(JSON.stringify(newGame(70)));
  old.v = 2; old.hall.h = 16; old.zones.forEach((z) => { z.y -= 18; z.doors.forEach((d) => { d.y -= 18; }); });
  old.buildings.forEach((b) => { b.y -= 18; });
  const bb = {}; for (const k in old.belts) { const c = old.belts[k]; c.y -= 18; bb[`${c.x},${c.y}`] = c; } old.belts = bb;
  old.workers.forEach((w) => { w.y -= 18; }); old.cash = 777; delete old.stock.aluminio;
  const m = new Simulation(old); assert(m.s.v === 3 && m.s.cash === 777 && m.s.hall.h === 34 && m.s.stock.aluminio === 0);
  run(m, 60); assert(m.s.stats.produced >= 0 && m.s.buildings.find((b) => b.type === 'st1').done > 0, 'continua produzindo');
}

// 13. Muitos funcionários: a simulação continua leve
{
  const a = new Simulation(newGame(80)); const s = a.s; s.cash = 1e8;
  let lots = 0; const keys = ['usinagem', 'injecao', 'cilindros', 'embalagem', 'motores', 'brunimento'];
  for (let i = 0; i < 18; i++) { const r = buyBuilding(a, keys[i % keys.length]); if (!r.ok) break; lots++; const t = { usinagem: 'cnc', injecao: 'injetora', cilindros: 'acab', embalagem: 'label', motores: 'bancada', brunimento: 'brunidora' }[r.zone.sector]; for (let n = 0; n < 8; n++) { const p = placeInZone(s, t, r.zone); if (!p) break; if (a.build(t, p.x, p.y).ok) hire(a, 'assembler'); } }
  for (let i = 0; i < 40; i++) hire(a, 'stock');
  const t0 = Date.now(); run(a, 60); const ms = Date.now() - t0;
  console.log(`${lots} prédios novos, ${s.workers.length} funcionários: 60 s de jogo em ${ms} ms`);
  assert(lots >= 18, 'complexo com dezenas de prédios');
}
console.log('Todos os testes passaram.');
