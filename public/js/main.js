/* global Phaser */
import { GAME } from './config.js';
import { Simulation } from './core/sim.js';
import { newGame } from './core/state.js';
import { load, clearSave } from './core/save.js';
import { FactoryScene } from './render/scene.js';
import { UI } from './ui/ui.js';

const start = document.getElementById('start');
const saved = load();
const cont = document.getElementById('btn-continue');
if (saved) {
  const s = saved.state;
  cont.hidden = false;
  cont.querySelector('small').textContent = `Dia ${s.day} · R$ ${Math.round(s.cash).toLocaleString('pt-BR')}`;
}

function boot(state) {
  start.hidden = true;
  const sim = new Simulation(state);
  const ui = new UI(sim, document.getElementById('game'));
  window.__sim = sim; window.__ui = ui;
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'stage', backgroundColor: '#171d1a',
    pixelArt: true, antialias: false, roundPixels: false,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { touch: true, activePointers: 3 }, banner: false,
    scene: [],
  });
  game.scene.add('factory', FactoryScene, true, { sim, ui });
  ui.toast('good', `Linha ligada. A MS 170 já está em produção. Abra Estoque para repor componentes.`);
}

document.getElementById('btn-new').addEventListener('click', () => { clearSave(); boot(newGame()); });
cont.addEventListener('click', () => boot(saved.state));
document.title = GAME.title;
