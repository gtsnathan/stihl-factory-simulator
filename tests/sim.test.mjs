// Execute com: node tests/sim.test.mjs
import assert from 'node:assert';
import { Simulation } from '../public/js/core/sim.js';
import { newGame } from '../public/js/core/state.js';
import { kitFor, buy, stockUsed } from '../public/js/systems/inventory.js';
import { acceptOffer, sellSpot } from '../public/js/systems/economy.js';
import { requestRepair } from '../public/js/systems/machines.js';
import { hire } from '../public/js/systems/workers.js';
import { GAME } from '../public/js/config.js';

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
  assert(buy(sim, kitFor(10)).ok); const before = stockUsed(sim.s); run(sim, 21);
  assert(stockUsed(sim.s) !== before, 'entrega chega');
}

// 6. Construção, esteira ligada e técnico em nova estação
{
  const sim = new Simulation(newGame(12));
  assert(!sim.build('st1', 2, 4).ok, 'célula ocupada');
  assert(sim.build('st1', 2, 1).ok); assert(sim.build('belt', 4, 2, 'E').ok);
  assert(hire(sim, 'assembler').ok); assert(hire(sim, 'tech').ok);
  run(sim, 30);
  const novo = sim.s.buildings.find((b) => b.type === 'st1' && b.y === 1);
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
console.log('Todos os testes passaram.');
