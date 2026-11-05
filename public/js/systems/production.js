import { STATION_STAGES, COMPONENTS, PHASES } from '../config.js';
import { rng } from '../core/state.js';

export function finishUnit(sim, b, op) {
  const s = sim.s, def = STATION_STAGES[b.type];
  if (def.inspects) {
    const skill = 1 + op.train * .15 + Math.min(.3, op.xp / 3600);
    const chance = .05 * (1 + b.wear / 100) / skill * (s.research.done.pokayoke ? .5 : 1) * sim.fx.defect;
    if (rng(s) < chance) {
      b.bad++;
      if (rng(s) < sim.fx.rework) {
        s.stats.reworked++;
        b.busy = true; b.progress = 0; // retrabalho: refaz o ciclo sem gastar novos componentes
        sim.emit('toast', { kind: 'warn', text: 'Defeito na inspeção: unidade em retrabalho.' });
      } else {
        s.stats.scrapped++; s.today.scrapped++;
        sim.emit('toast', { kind: 'bad', text: 'Defeito grave: unidade enviada ao refugo.' });
        sim.emit('scrap', { id: b.id });
      }
      return;
    }
    b.good++;
    s.stats.produced++; s.today.produced++; s.hourNow.produced++;
    sim.emit('produced', { id: b.id });
  } else { b.good++; }
  b.outbox++;
}

export function unitCost() {
  const mats = {};
  for (const k in STATION_STAGES) for (const m in STATION_STAGES[k].mats) mats[m] = (mats[m] || 0) + STATION_STAGES[k].mats[m];
  return Object.entries(mats).reduce((sum, [m, q]) => sum + COMPONENTS[m].price * q, 0);
}

// OEE = disponibilidade × desempenho × qualidade, a partir do tempo de cada estação.
export function computeEfficiency(s) {
  const st = s.buildings.filter((b) => b.t && b.type !== 'desk');
  if (!st.length) return { oee: 0, avail: 0, perf: 0, qual: 1 };
  let total = 0, broken = 0, run = 0, good = 0, bad = 0;
  for (const b of st) {
    const t = b.t; const sum = t.run + t.starved + t.blocked + t.broken + t.absent;
    total += sum; broken += t.broken; run += t.run; good += b.good; bad += b.bad;
  }
  if (total <= 0) return { oee: 0, avail: 0, perf: 0, qual: 1 };
  const avail = 1 - broken / total;
  const perf = run / Math.max(1e-6, total - broken);
  const qual = good + bad > 0 ? good / (good + bad) : 1;
  return { oee: avail * perf * qual, avail, perf, qual };
}

// A estação com mais tempo produzindo, sem tempo de espera por outras, limita a linha.
export function findBottleneck(s) {
  const st = s.buildings.filter((b) => STATION_STAGES[b.type] && b.t.run > 5);
  if (st.length < 2) return null;
  const byStage = {};
  for (const b of st) {
    const def = STATION_STAGES[b.type];
    const cap = 1 / def.cycle;
    byStage[def.stage] = byStage[def.stage] || { cap: 0, station: b };
    byStage[def.stage].cap += cap;
  }
  return Object.values(byStage).sort((a, b) => a.cap - b.cap)[0].station;
}

export function phaseInfo(s) {
  let i = 0;
  while (s.stats.sold >= PHASES[i].goal && i < PHASES.length - 1) i++;
  return { index: i, ...PHASES[i] };
}
