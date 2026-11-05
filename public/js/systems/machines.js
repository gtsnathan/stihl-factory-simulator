import { BUILDINGS, STATION_STAGES } from '../config.js';
import { rng } from '../core/state.js';
import { pay } from './economy.js';
import { pushToOutputs } from './logistics.js';
import { workerProductivity } from './workers.js';
import { finishUnit } from './production.js';

export const isStation = (b) => !!b.t;
export const REPAIR = { externalCost: 1800, externalTime: 30, preventiveCost: 900, preventiveTime: 12 };

export function cycleTime(sim, b) {
  return STATION_STAGES[b.type].cycle * (sim.s.research.done.pneumatic ? .85 : 1) * sim.fx.cycle;
}
export function failureChance(b) { // chance por hora de jogo, mostrada ao jogador
  if (b.wear < 50) return 0;
  const hazard = Math.pow((b.wear - 50) / 50, 2) * .01;
  return Math.min(1, 1 - Math.pow(1 - hazard, 45));
}
const hasMaterials = (b) => {
  const m = STATION_STAGES[b.type].mats;
  for (const k in m) if ((b.buffer[k] || 0) < m[k]) return false;
  return true;
};

export function updateStation(sim, b, dt) {
  const s = sim.s, def = STATION_STAGES[b.type];
  if (b.outbox > 0) pushToOutputs(sim, b);

  if (b.broken) {
    b.t.broken += dt; b.status = 'broken';
    if (b.externalRepair) { b.repairT -= dt; if (b.repairT <= 0) completeRepair(sim, b, 'Reparo terceirizado', REPAIR.externalCost); }
    return;
  }
  const op = s.workers.find((w) => w.id === b.operatorId && w.state === 'work');
  if (!op) { b.t.absent += dt; b.status = 'no_operator'; return; }

  if (!b.busy) {
    if (b.outbox > 0) { b.t.blocked += dt; b.status = 'blocked'; return; }
    if (def.stage > 1 && b.inbox <= 0) { b.t.starved += dt; b.status = 'starved_wip'; return; }
    if (!hasMaterials(b)) { b.t.starved += dt; b.status = 'starved_mat'; return; }
    for (const k in def.mats) b.buffer[k] -= def.mats[k];
    if (def.stage > 1) b.inbox--;
    b.busy = true; b.progress = 0;
  }

  b.status = 'running'; b.t.run += dt; b.hours += dt / 45;
  b.progress += dt / cycleTime(sim, b) * workerProductivity(op);
  op.xp += dt; op.fatigue = Math.min(1, op.fatigue + .0025 * sim.fx.fatigue * dt);
  const wearRate = .11 * (s.research.done.lube ? .7 : 1) * sim.fx.wear;
  b.wear = Math.min(100, b.wear + wearRate * dt);
  if (b.wear > 50 && rng(s) < Math.pow((b.wear - 50) / 50, 2) * .01 * dt || b.wear >= 100) {
    b.broken = true; b.externalRepair = false; b.status = 'broken';
    b.fault = { kind: 'maint', text: `${BUILDINGS[b.type].name} parada por desgaste`, at: s.time };
    sim.emit('toast', { kind: 'bad', text: `Chamado aberto: ${b.fault.text}.` });
    sim.emit('breakdown', { id: b.id });
    return;
  }
  if (b.progress >= 1) {
    b.busy = false; b.progress = 0; b.done++;
    finishUnit(sim, b, op);
  }
}

export function requestRepair(sim, b) {
  if (!b.broken) return { ok: false, msg: 'A máquina está funcionando.' };
  if (b.externalRepair) return { ok: false, msg: 'O reparo já está a caminho.' };
  if (sim.s.cash < REPAIR.externalCost) return { ok: false, msg: 'Falta dinheiro para o reparo.' };
  b.externalRepair = true; b.repairT = REPAIR.externalTime;
  return { ok: true, msg: `Reparo chega e termina em ${REPAIR.externalTime} s.` };
}
export function preventiveMaintenance(sim, b) {
  if (b.broken) return requestRepair(sim, b);
  if (b.wear < 5) return { ok: false, msg: 'O desgaste ainda está baixo.' };
  if (sim.s.cash < REPAIR.preventiveCost) return { ok: false, msg: 'Falta dinheiro para a manutenção.' };
  pay(sim, REPAIR.preventiveCost, 'maint');
  // Parada programada: a estação fica parada até concluir o serviço.
  b.broken = true; b.externalRepair = true; b.repairT = REPAIR.preventiveTime; b.preventive = true;
  return { ok: true, msg: `Manutenção preventiva em andamento por ${REPAIR.preventiveTime} s.` };
}
export function completeRepair(sim, b, label, cost) {
  const s = sim.s;
  const prev = b.preventive;
  if (!prev && cost) pay(sim, cost, 'maint');
  const itFault = b.fault?.kind === 'it';
  b.history.unshift({ day: s.day, kind: prev ? 'Preventiva' : b.fault?.text || label, cost: prev ? REPAIR.preventiveCost : cost, wear: Math.round(b.wear) });
  b.history = b.history.slice(0, 6);
  b.broken = false; b.externalRepair = false; b.preventive = false; b.techStop = false; if (!itFault) b.wear = 0; b.fault = null; b.techBy = null;
  sim.emit('toast', { kind: 'good', text: `${BUILDINGS[b.type].name} voltou a operar.` });
}
export function stationPower(b) {
  const d = BUILDINGS[b.type];
  return b.status === 'running' ? d.kwRun : (b.broken ? 0 : d.kwIdle);
}
