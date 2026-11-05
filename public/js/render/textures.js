import { Pix, shade, hash } from './pixel.js';
import { GAME } from '../config.js';

const STEEL = 0x59626d, ORANGE = 0xe4692a, BLUE = 0x2f6d9e, YELLOW = 0xe6b422, CARD = 0xb58d5a;
const fp = (w, h, H) => new Pix((w + h) * 32, (w + h) * 16 + H, h * 32, H);
const add = (scene, key, pix) => { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, pix.toCanvas()); };

function basePlate(p, w, h) {
  p.shadow(0, w, 0, h, .35);
  p.hazard(0, w, 0, h, 0);
  p.box(.08, w - .08, .08, h - .08, 0, 4, 0x3a4047);
}

function station1(p, f) { // prensa de montagem de motor com cabeçote móvel
  basePlate(p, 2, 2);
  p.box(.2, 1.8, 1.05, 1.8, 4, 20, 0x48515c);        // bancada
  p.top(.3, 1.7, 1.15, 1.7, 20, 0x69737f);
  p.box(.25, .75, .25, .95, 4, 56, ORANGE);          // coluna principal
  p.faceB(.95, .32, .68, 34, 50, 0x20262c);          // painel
  p.faceB(.95, .36, .46, 42, 46, f % 2 ? 0x5dd67a : 0x2d7a45);
  p.faceB(.95, .52, .62, 42, 46, f % 3 === 0 ? 0xffc34d : 0x77581e);
  p.box(.75, 1.55, .3, .85, 4, 18, STEEL);           // base da prensa
  p.box(1.45, 1.65, .4, .75, 18, 58, 0x707a86);      // guia
  const z = [46, 40, 33, 40][f];
  p.box(.95, 1.5, .42, .74, z, z + 9, ORANGE);       // cabeçote
  p.box(1.15, 1.28, .52, .64, 20, z, 0xb7bfc8, { edge: false }); // haste
  p.box(.9, 1.2, .46, .72, 18, 23, 0x8e98a4);        // peça sendo montada
  p.box(.45, .9, 1.25, 1.55, 20, 26, 0x8b5a2b);      // caixa de peças
}
function station2(p, f) { // bancada de combustível com mangueiras e braço de torque
  basePlate(p, 2, 2);
  p.box(.2, 1.8, .25, 1.05, 4, 24, 0x3f6f96);        // armário
  for (const a of [.45, .85, 1.25, 1.65]) p.faceB(1.05, a - .13, a + .13, 8, 20, 0x2c4f6e);
  p.top(.26, 1.74, .3, 1, 24, 0x7f8a96);
  p.box(.28, .62, .34, .68, 24, 40, 0xc8b04a);       // tanque
  p.box(.38, .52, .44, .58, 40, 45, 0x4b4f55, { edge: false });
  p.box(1.3, 1.45, .38, .55, 24, 62, 0x707a86);      // poste
  const sw = [0, .08, .16, .08][f];
  p.box(.72 + sw, 1.4, .42, .54, 56, 62, ORANGE);    // braço
  p.box(.76 + sw, .88 + sw, .44, .54, 36, 56, 0xb7bfc8, { edge: false }); // torqueadeira
  p.box(.74, 1.15, .66, .96, 24, 31, 0xe4692a);      // motosserra em montagem
  p.line(...p.P(.62, .68, 34), ...p.P(.9, .8, 31), 0x161a1e);
  p.box(.3, 1.7, 1.25, 1.75, 4, 12, 0x3a4047);
  for (let i = 0; i < 4; i++) p.box(.4 + i * .32, .64 + i * .32, 1.33, 1.65, 12, 16 + i % 2 * 3, [0x8f6a3c, 0x5f8fb5][i % 2]);
}
function station3(p, f) { // cabine de inspeção com lâmpada e seladora de caixas
  basePlate(p, 2, 2);
  p.box(.2, 1.8, .2, .5, 4, 62, 0x4b5560);           // parede de fundo
  p.faceB(.5, .34, 1.66, 26, 56, 0x151a20);          // tela da inspeção
  for (let i = 0; i < 3; i++) p.faceB(.5, .44 + i * .4, .7 + i * .4, 40, 52, (f + i) % 3 ? 0x2d7a45 : 0x5dd67a);
  p.box(.2, 1.8, .15, .22, 62, 66, 0xdfe6ec);        // lâmpada
  p.box(.3, 1.7, .55, 1.25, 4, 20, 0x59626d);        // mesa
  p.top(.34, 1.66, .6, 1.2, 20, 0x8b96a2);
  const a = [.5, .62, .74, .62][f];
  p.box(a, a + .34, .72, 1.08, 20, 26, 0xe4692a);    // corpo
  p.box(a + .34, a + .68, .85, .95, 21, 24, 0xc2c9d1, { edge: false }); // sabre
  p.box(.35, 1.1, 1.38, 1.82, 4, 24, CARD);          // caixas prontas
  p.line(...p.P(.35, 1.6, 24), ...p.P(1.1, 1.6, 24), 0xe3d1ae);
  p.box(1.25, 1.75, 1.38, 1.82, 4, 16, shade(CARD, .9));
}


// ---------- Sprites dos setores ----------
const STEEL2 = 0x707a86, DKP = 0x20262c;
const panel = (p, a0, a1, b, z0, z1, f) => { p.faceB(b, a0, a1, z0, z1, DKP); p.faceB(b, a0 + .05, a0 + (a1 - a0) * .45, z0 + 3, z1 - 3, f % 2 ? 0x5dd67a : 0x2d7a45); };
const ART = {
  forno(p, f) { // forno com boca incandescente
    basePlate(p, 2, 2);
    p.box(.25, 1.75, .25, 1.7, 4, 44, 0x4d4640);
    p.box(.35, 1.65, .35, 1.6, 44, 50, 0x2e2a27);
    const hot = [0xff8a2a, 0xffb347, 0xff6a1a, 0xffa030][f];
    p.faceB(1.7, .6, 1.4, 12, 34, 0x1a1512); p.faceB(1.7, .7, 1.3, 15, 31, hot); p.faceA(1.75, .6, 1.4, 14, 30, shade(hot, .7));
    p.box(.6, .9, .6, .9, 50, 68, 0x3a3f45, { edge: false });
    p.top(.66, .84, .66, .84, 68, 0x20262c);
  },
  diecast(p, f) { // injetora de metal: duas placas que abrem e fecham
    basePlate(p, 2, 2);
    p.box(.2, 1.8, .55, 1.45, 4, 18, 0x3f6f96);
    const g = [.12, .05, 0, .05][f];
    p.box(.3, .7 - g, .6, 1.4, 18, 50, ORANGE); p.box(1.1 + g, 1.7, .6, 1.4, 18, 50, 0x5a646f);
    p.box(.7 - g, 1.1 + g, .92, 1.08, 34, 38, 0xb7bfc8, { edge: false });
    p.box(.25, .65, .15, .5, 4, 40, 0x48515c); panel(p, .3, .6, .5, 22, 36, f);
  },
  cnc(p, f) { // cabine fechada com janela e cabeçote
    basePlate(p, 2, 2);
    p.box(.2, 1.8, .25, 1.75, 4, 56, 0xdfe3e6);
    p.faceB(1.75, .35, 1.3, 18, 48, 0x2b3a44);
    p.faceB(1.75, .7 + f * .08, .86 + f * .08, 30, 48, 0xb7bfc8);
    if (f % 2) p.faceB(1.75, .72, .84, 24, 28, 0xffd166);
    p.faceB(1.75, 1.38, 1.7, 26, 48, DKP); p.faceB(1.75, 1.43, 1.65, 38, 45, f % 2 ? 0x6ec6ff : 0x2f6d9e);
    p.faceA(1.8, .4, 1.6, 40, 52, ORANGE); p.top(.3, 1.7, .35, 1.65, 56, 0xb8bec3);
  },
  torno(p, f) { // barramento longo e peça girando
    basePlate(p, 2, 2);
    p.box(.15, 1.85, .7, 1.3, 4, 22, 0x3f5e74);
    p.box(.2, .65, .72, 1.28, 22, 44, 0x4e7088);
    p.box(1.45, 1.75, .85, 1.15, 22, 36, 0x4e7088);
    p.box(.65, 1.45, .95, 1.05, 30, 34, f % 2 ? 0xd8dde2 : 0x9aa3ac, { edge: false });
    p.box(.9 + f * .1, 1.1 + f * .1, .86, 1.14, 22, 28, ORANGE);
    p.box(.25, .75, .2, .55, 4, 26, 0x48515c); panel(p, .3, .7, .55, 12, 24, f);
  },
  fresa(p, f) { // coluna com cabeçote vertical
    basePlate(p, 2, 2);
    p.box(.65, 1.35, .25, .8, 4, 62, 0x5d7486);
    const z = [46, 42, 38, 42][f];
    p.box(.75, 1.25, .8, 1.25, z, z + 12, ORANGE);
    p.box(.95, 1.05, .98, 1.08, z - 10, z, 0xc2c9d1, { edge: false });
    p.box(.45, 1.55, .9, 1.65, 4, 22 , 0x48515c); p.top(.5 + f * .03, 1.5 + f * .03, .95, 1.6, 22, 0x8b96a2);
    p.box(.85, 1.2, 1.15, 1.45, 22, 28, 0xc4ccd4);
  },
  acab(p, f) { // bancada com relógio de medição
    basePlate(p, 2, 2);
    p.box(.2, 1.8, .55, 1.5, 4, 22, 0x59626d); p.top(.25, 1.75, .6, 1.45, 22, 0x98a2ad);
    p.box(.5, .85, .85, 1.2, 22, 34, 0xa5adb5); p.top(.58, .77, .93, 1.12, 34, 0x303840);
    p.box(1.25, 1.35, .75, .85, 22, 54, STEEL2, { edge: false });
    p.box(.85, 1.35, .77, .83, 48, 52, 0xe6b422, { edge: false });
    p.box(.25, 1.75, .15, .4, 4, 44, 0x48515c); panel(p, .35, 1.65, .4, 24, 40, f);
  },
  tanque(p, f) { // tanque com líquido e ponte levantando a peça
    basePlate(p, 2, 2);
    p.box(.2, 1.8, .55, 1.75, 4, 26, 0x2f5f58);
    p.top(.28, 1.72, .63, 1.67, 26, (f % 2 ? 0x7fd4c0 : 0x63bfaa));
    for (let i = 0; i < 4; i++) p.px(...p.P(.45 + i * .3, .85 + ((i + f) % 3) * .25, 27), 0xe6fff8);
    p.box(.25, .35, .22, .34, 4, 62, STEEL2, { edge: false }); p.box(1.65, 1.75, .22, .34, 4, 62, STEEL2, { edge: false });
    p.box(.25, 1.75, .22, .34, 58, 62, ORANGE, { edge: false });
    const z = [34, 42, 50, 42][f];
    p.box(.9, 1.0, 1.0, 1.1, z, 58, 0x2b2f34, { edge: false }); p.box(.82, 1.08, .94, 1.16, z - 8, z, 0xdfe6ec);
  },
  residuo(p, f) { // tanques cilíndricos e tubos
    basePlate(p, 2, 2);
    for (const [a, b, c] of [[.3, .35, 0x5e8a7d], [1.1, .35, 0x7a7f3e]]) { p.box(a, a + .6, b, b + .6, 4, 48, c); p.top(a + .1, a + .5, b + .1, b + .5, 48, shade(c, .7)); }
    p.box(.3, 1.7, 1.2, 1.7, 4, 16, 0x48515c); panel(p, .5, 1.5, 1.7, 7, 15, f);
    p.box(.9, 1.1, .55, .65, 30, 34, 0x9aa3ac, { edge: false });
  },
  brunidora(p, f) { // máquina vertical com haste que sobe e desce dentro do cilindro
    basePlate(p, 2, 2);
    p.box(.25, 1.75, .25, .85, 4, 66, 0x6a5d86);
    p.box(.3, 1.7, .85, 1.7, 4, 20, 0x4b4560);
    const z = [28, 22, 32, 22][f];
    p.box(.85, 1.15, 1.05, 1.35, 20, 32, 0xdfe6ec); p.top(.91, 1.09, 1.11, 1.29, 32, 0x20262c);
    p.box(.95, 1.05, 1.15, 1.25, z + 4, 62, 0xc2c9d1, { edge: false }); p.box(.75, 1.25, .85, 1.3, 54, 62, ORANGE);
    panel(p, .35, .75, .85, 34, 50, f);
  },
  injetora(p, f) { // injetora longa com funil e molde
    basePlate(p, 2, 2);
    p.box(.12, 1.88, .6, 1.4, 4, 24, 0x315f83);
    p.box(.2, .9, .68, 1.32, 24, 40, 0x3f7aa8);
    p.box(.35, .65, .85, 1.15, 40, 58, 0xd9823b); p.top(.3, .7, .8, 1.2, 58, 0xb86a2c);
    const g = [.1, .04, 0, .04][f];
    p.box(1.0, 1.25 - g, .65, 1.35, 24, 50, ORANGE); p.box(1.45 + g, 1.8, .65, 1.35, 24, 50, 0x5a646f);
    p.box(.2, .9, .15, .48, 4, 30, 0x48515c); panel(p, .3, .8, .48, 14, 26, f);
    p.box(1.05, 1.75, 1.5, 1.82, 4, 9, 0x23272d); p.box(1.2 + f * .1, 1.42 + f * .1, 1.56, 1.76, 9, 14, 0xe4692a);
  },
  bancada(p, f) { // mesa de montagem e testador de motor
    basePlate(p, 2, 2);
    p.box(.2, 1.8, .6, 1.45, 4, 22, 0x4e6650); p.top(.25, 1.75, .65, 1.4, 22, 0x8a9a84);
    p.box(.65, 1.1, .85, 1.2, 22, 36, ORANGE); p.box(.74, 1.0, .94, 1.1, 36, 42, 0xa5adb5);
    p.box(1.3, 1.65, .8, 1.15, 22, 28, 0xb58d5a);
    p.box(.25, 1.75, .15, .42, 4, 46, 0x48515c); panel(p, .35, 1.1, .42, 26, 42, f);
    p.box(1.4, 1.46, .95, 1.01, 28, 42 + f * 2, 0xe6b422, { edge: false });
  },
  robot(p, f) { // braço robótico amarelo sobre base
    basePlate(p, 2, 2);
    p.box(.25, 1.75, 1.05, 1.75, 4, 20, 0x59626d); p.box(.55, 1.15, 1.2, 1.6, 20, 28, ORANGE);
    p.box(.5, 1.05, .35, .85, 4, 14, 0x303840);
    const sw = [0, .18, .3, .18][f];
    p.box(.62, .93, .47, .73, 14, 40, YELLOW);
    p.box(.66 + sw * .5, 1.05 + sw * .5, .5 + sw, .7 + sw, 40, 48, YELLOW);
    p.box(.9 + sw * .5, 1.03 + sw * .5, .6 + sw, .72 + sw, 28, 40, 0xc2a020);
    p.box(.92 + sw * .5, 1.01 + sw * .5, .62 + sw, .7 + sw, 22, 28, 0xb7bfc8, { edge: false });
  },
  label(p, f) { // esteira curta, impressora de etiquetas, leitor e caixas
    basePlate(p, 2, 2);
    p.box(.15, 1.85, .95, 1.45, 4, 16, 0x3a4047); p.top(.15, 1.85, 1.0, 1.4, 16, 0x1b1e22);
    p.box(.25 + f * .25, .65 + f * .25, 1.03, 1.37, 16, 28, CARD);
    p.box(.3, .75, .3, .75, 4, 34, 0xe8ebee); p.faceB(.75, .36, .68, 18, 30, DKP); p.faceB(.75, .4, .54, 24, 28, f % 2 ? 0x5dd67a : 0x2d7a45);
    p.box(.43, .62, .75, .82, 18, 21 + f, 0xffffff, { edge: false });
    p.box(1.25, 1.33, .6, .68, 4, 38, STEEL2, { edge: false }); p.box(1.2, 1.4, .68, .82, 34, 38, 0x20262c, { edge: false });
    if (f % 2) p.line(...p.P(1.3, .85, 34), ...p.P(1.3, 1.15, 17), 0xff4a4a);
  },
  desk(p, f) { // mesas com computadores
    p.shadow(0, 2, 0, 2, .25); p.top(.04, 1.96, .04, 1.96, 0, 0x3f4a55);
    for (const [a, b] of [[.2, .25], [1.1, .25], [.2, 1.1], [1.1, 1.1]]) {
      p.box(a, a + .72, b, b + .5, 0, 14, 0x9c7a4d);
      p.box(a + .22, a + .5, b + .08, b + .14, 14, 26, 0x1f242a, { edge: false });
      p.faceB(b + .14, a + .25, a + .47, 17, 25, (f + a * 3) % 2 > 1 ? 0x6ec6ff : 0x3d86b8);
      p.box(a + .2, a + .5, b + .24, b + .4, 14, 15, 0x2b2f34, { edge: false });
    }
  },
};

function rack(p, a0, a1, b0, b1, color, fill, boxColor) {
  const lv = [6, 26, 46];
  for (const u of [a0, (a0 + a1) / 2, a1 - .08]) for (const v of [b0, b1 - .08]) p.box(u, u + .08, v, v + .08, 0, 62, color, { edge: false });
  lv.forEach((z, li) => {
    p.box(a0, a1, b0, b1, z, z + 2, ORANGE, { edge: false });
    const n = 4;
    for (let i = 0; i < n; i++) {
      if ((li * n + i) / (n * 3) >= fill) continue;
      const u = a0 + .06 + i * (a1 - a0 - .1) / n;
      const c = shade(boxColor, .86 + hash(i, li) * .28);
      p.box(u, u + (a1 - a0 - .2) / n, b0 + .08, b1 - .1, z + 2, z + 14, c, { edge: false });
      if (hash(li, i) > .5) p.line(...p.P(u + .03, b1 - .1, z + 8), ...p.P(u + (a1 - a0 - .2) / n, b1 - .1, z + 8), 0xe3d1ae, .7);
    }
  });
}
function depot(p, fill) {
  p.shadow(0, 4, 0, 3, .3);
  p.top(0, 4, 0, 3, 0, 0x4a4e52);
  rack(p, .15, 3.85, .15, .95, BLUE, fill, CARD);
  rack(p, .15, 3.85, 1.25, 2.05, BLUE, fill, shade(CARD, .92));
  p.top(.15, 3.85, 2.3, 2.85, 0, 0xe6b422, .35);
  p.box(.3, 1.2, 2.35, 2.8, 0, 8, 0x8a5b2c);
}
function dock(p, fill) {
  p.shadow(0, 4, 0, 3, .3);
  p.top(0, 4, 0, 3, 0, 0x45494e);
  rack(p, .15, 3.85, .15, .95, 0x4a6a55, fill, CARD);
  p.hazard(.1, 3.9, 2.55, 2.9, 0);
  for (let i = 0; i < 2; i++) {
    const a = .4 + i * 1.7;
    p.box(a, a + 1.2, 1.35, 2.15, 0, 5, 0x8a5b2c);
    if (fill > .25 + i * .4) p.box(a + .08, a + 1.12, 1.42, 2.08, 5, 28, shade(CARD, .95 + i * .05));
  }
}
function pallet(p, n) {
  p.shadow(0, 2, 0, 2, .25);
  p.hazard(.05, 1.95, .05, 1.95, 0);
  p.top(.2, 1.8, .2, 1.8, 0, 0x3c4045);
  p.box(.3, 1.7, .3, 1.7, 0, 5, 0x8a5b2c);
  const cells = [[.36, .36], [1.04, .36], [.36, 1.04], [1.04, 1.04], [.36, .36], [1.04, .36]];
  for (let i = 0; i < n; i++) {
    const [u, v] = cells[i], z = i >= 4 ? 19 : 5;
    p.box(u, u + .62, v, v + .62, z, z + 14, shade(CARD, .9 + hash(i, 2) * .2));
    p.line(...p.P(u, v + .62, z + 8), ...p.P(u + .62, v + .62, z + 8), 0xe3d1ae, .8);
  }
}
function rest(p) {
  p.shadow(0, 3, 0, 2, .25);
  p.top(.04, 2.96, .04, 1.96, 0, 0x4f6a63);
  p.box(.2, .7, .2, .6, 0, 54, 0xb03b2e);             // máquina de bebidas
  p.faceB(.6, .28, .62, 22, 48, 0x1a2a33);
  for (let i = 0; i < 3; i++) p.faceB(.6, .32, .58, 26 + i * 7, 29 + i * 7, [0xe6b422, 0x5dd67a, 0xf0f0f0][i]);
  p.box(1.1, 2.1, .7, 1.3, 11, 15, 0x9c7a4d);          // mesa
  p.box(1.5, 1.7, .9, 1.1, 0, 11, 0x3b3f44);
  p.box(1.05, 2.2, .3, .52, 0, 8, BLUE);               // bancos
  p.box(1.05, 2.2, 1.5, 1.72, 0, 8, BLUE);
  p.box(2.5, 2.85, .2, .55, 0, 30, 0xcfd6dc);          // bebedouro
  p.box(2.56, 2.8, .26, .5, 30, 44, 0x8fd1ec);
}

function beltTex(dirAxis, rev, f) {
  const p = new Pix(64, 44, 32, 12);
  const a0 = dirAxis === 'a' ? 0 : .14, a1 = dirAxis === 'a' ? 1 : .86, b0 = dirAxis === 'a' ? .14 : 0, b1 = dirAxis === 'a' ? .86 : 1;
  p.top(.02, 1.04, .02, 1.04, 0, 0x06080a, .22);
  p.box(a0, a1, b0, b1, 0, 8, 0x3a4047, { edge: false });
  p.top(a0, a1, b0, b1, 8, 0x1b1e22);
  const t = ((rev ? -f : f) / 4 + 1) % 1;
  for (let k = 0; k < 4; k++) {
    const u = ((k + t) / 4) % 1;
    if (dirAxis === 'a') p.top(u, Math.min(1, u + .06), b0 + .03, b1 - .03, 8, 0x3b4148);
    else p.top(a0 + .03, a1 - .03, u, Math.min(1, u + .06), 8, 0x3b4148);
  }
  // Seta que indica o sentido da esteira.
  const ar = (u, v) => p.P(u, v, 8);
  const y = rev ? -1 : 1;
  if (dirAxis === 'a') p.poly([ar(.5 + .14 * y, .5), ar(.5 - .08 * y, .32), ar(.5 - .08 * y, .68)], 0xe6b422, .75);
  else p.poly([ar(.5, .5 + .14 * y), ar(.32, .5 - .08 * y), ar(.68, .5 - .08 * y)], 0xe6b422, .75);
  // Trilhos laterais
  if (dirAxis === 'a') { p.box(a0, a1, b0 - .04, b0 + .03, 8, 11, 0xe4692a, { edge: false }); p.box(a0, a1, b1 - .03, b1 + .04, 8, 11, 0xe4692a, { edge: false }); }
  else { p.box(a0 - .04, a0 + .03, b0, b1, 8, 11, 0xe4692a, { edge: false }); p.box(a1 - .03, a1 + .04, b0, b1, 8, 11, 0xe4692a, { edge: false }); }
  return p;
}
function splitterTex(f) {
  const p = new Pix(64, 44, 32, 12);
  p.top(.02, 1.04, .02, 1.04, 0, 0x06080a, .22);
  p.box(.1, .9, .1, .9, 0, 10, 0x3d5d7a);
  p.top(.2, .8, .2, .8, 10, 0x1b1e22);
  const r = f * Math.PI / 2;
  const cx = (u) => .5 + Math.cos(r + u) * .22, cy = (u) => .5 + Math.sin(r + u) * .22;
  p.poly([p.P(cx(0), cy(0), 10), p.P(cx(2.4), cy(2.4), 10), p.P(cx(3.9), cy(3.9), 10)], YELLOW);
  return p;
}

function itemTex(stage) {
  const p = new Pix(36, 28, 18, 16);
  if (stage === 3) {
    p.top(.08, .62, .08, .62, 0, 0, .25);
    p.box(.0, .5, .0, .5, 0, 13, CARD);
    p.line(...p.P(0, .5, 7), ...p.P(.5, .5, 7), 0xe3d1ae);
    return p;
  }
  p.top(-.05, .6, -.05, .6, 0, 0, .22);
  p.box(0, .52, .05, .42, 0, 3, 0x505860, { edge: false });
  p.box(.07, .44, .1, .36, 3, 11, stage === 1 ? 0x9099a5 : ORANGE);
  p.box(.15, .35, .16, .3, 11, 15, stage === 1 ? ORANGE : 0xe2e6ea);
  if (stage === 2) { p.box(.44, .68, .17, .26, 5, 8, 0xc2c9d1, { edge: false }); }
  return p;
}

const ROLE_COLOR = { assembler: 0xe4692a, stock: 0x3c9a63, fork: 0xd6b02c, tech: 0xc23b3b, it: 0x3f7fd0, office: 0x7a6bb8 };
const SKIN = [0xf0c49a, 0xc98f60, 0x8a5a38];
function workerTex(role, back, frame, skin) {
  const p = new Pix(16, 26), c = ROLE_COLOR[role], pants = 0x2f3b4b, d = shade(c, .7);
  p.rect(4, 24, 9, 2, 0, .25);
  const legA = frame === 1 ? 2 : 0, legB = frame === 2 ? 2 : 0;
  p.rect(5, 17, 3, 7 - legA, pants); p.rect(9, 17, 3, 7 - legB, pants);
  p.rect(5, 24 - legA, 3, 1, 0x15181c); p.rect(9, 24 - legB, 3, 1, 0x15181c);
  p.rect(4, 9, 9, 8, c); p.rect(4, 13, 9, 1, 0xf3ecc8); p.rect(4, 15, 1, 2, d); p.rect(12, 15, 1, 2, d);
  if (back) p.rect(6, 10, 5, 2, 0xf3ecc8);
  const up = frame === 3, up2 = frame === 4;
  p.rect(2, up ? 7 : (up2 ? 8 : 10), 2, 6, d); p.rect(13, up2 ? 7 : (up ? 8 : 10), 2, 6, d);
  p.rect(2, up ? 6 : (up2 ? 7 : 16), 2, 2, SKIN[skin]); p.rect(13, up2 ? 6 : (up ? 7 : 16), 2, 2, SKIN[skin]);
  p.rect(5, 3, 7, 6, SKIN[skin]);
  if (!back) { p.px(6, 5, 0x20242a); p.px(10, 5, 0x20242a); p.rect(7, 7, 3, 1, shade(SKIN[skin], .75)); }
  else p.rect(5, 6, 7, 3, 0x3b2c20);
  const hat = role === 'it' || role === 'office' ? 0x3b2c20 : role === 'tech' ? 0xe9edf0 : role === 'stock' ? 0xe6b422 : role === 'fork' ? 0xf0f0f0 : 0xf2d23f;
  p.rect(4, 2, 9, 2, hat); p.rect(5, 1, 7, 1, shade(hat, 1.1)); p.rect(4, 4, 9, 1, shade(hat, .72));
  return p;
}
function forkTex(back, loaded) {
  const p = new Pix(84, 62, 42, 38);
  p.top(-.3, .6, -.32, .32, 0, 0, .28);
  const dirS = back ? -1 : 1;
  const a0 = -.32, a1 = .32;
  p.box(a0, a1, -.25, .25, 3, 16, YELLOW);
  p.box(a0, a0 + .2, -.22, .22, 16, 21, 0x3a3f45);
  // Rodas
  for (const u of [-.2, .2]) { p.box(u - .08, u + .08, .22, .3, 0, 8, 0x14171a, { edge: false }); }
  // Teto de proteção
  for (const [u, v] of [[-.25, -.2], [-.25, .17], [.22, -.2], [.22, .17]]) p.box(u, u + .04, v, v + .04, 16, 42, 0x282c31, { edge: false });
  p.top(-.27, .28, -.22, .23, 42, 0x31363c);
  p.box(-.08, .1, -.08, .08, 16, 27, 0xf0c49a, { edge: false });
  p.box(-.09, .11, -.09, .09, 27, 31, 0xf2f2f2, { edge: false });
  // Mastro e garfos
  const m = dirS * .33;
  p.box(m - .03, m + .03, -.2, .2, 2, 46, 0x2b2f34, { edge: false });
  const f0 = dirS > 0 ? m : m - .55, f1 = dirS > 0 ? m + .55 : m;
  p.box(f0, f1, -.17, -.09, 5, 7, 0xa3acb6, { edge: false });
  p.box(f0, f1, .09, .17, 5, 7, 0xa3acb6, { edge: false });
  if (loaded) {
    p.box(f0, f1, -.24, .24, 7, 10, 0x8a5b2c, { edge: false });
    p.box(f0 + .04, f1 - .04, -.2, .2, 10, 25, CARD);
    p.line(...p.P(f0 + .04, .2, 18), ...p.P(f1 - .04, .2, 18), 0xe3d1ae);
  }
  return p;
}
// u = comprimento a partir da cabine (0 a 4,4); v = largura (0 a 1). dir é o sentido em que o caminhão anda.
function truckTex(dir) {
  const p = new Pix(340, 240, 170, 125), L = 4.4;
  const R = (u0, u1, v0, v1) => (dir === 'W' ? [u0, u1, v0, v1] : dir === 'E' ? [L - u1, L - u0, v0, v1] : [v0, v1, u0, u1]);
  const B = (u0, u1, v0, v1, z0, z1, c, o) => { const [a0, a1, b0, b1] = R(u0, u1, v0, v1); p.box(a0, a1, b0, b1, z0, z1, c, o); };
  const side = (u0, u1, z0, z1, c) => { // pinta a lateral visível do caminhão
    if (dir === 'N') p.faceA(1, u0, u1, z0, z1, c); else { const [a0, a1] = R(u0, u1, 0, 1); p.faceB(1, a0, a1, z0, z1, c); }
  };
  { const [a0, a1, b0, b1] = R(-.05, L + .1, -.05, 1.15); p.top(a0, a1, b0, b1, 0, 0, .3); }
  const paint = () => {
    B(.95, L, .05, .95, 6, 12, 0x2b2f34, { edge: false });
    B(.95, L, 0, 1, 12, 76, 0xe7ecef);                      // baú
    side(1, L - .05, 22, 27, ORANGE); side(1, L - .05, 14, 17, 0x444b53);
  };
  const cab = () => {
    B(0, .95, .05, .95, 8, 42, 0xc7d0d8);                   // cabine
    side(.1, .75, 24, 38, 0x1f3442);
    if (dir === 'E') p.faceA(L, .1, .9, 24, 37, 0x294455);  // para-brisa à vista
    if (dir === 'N') p.faceB(.95, .1, .9, 24, 36, 0x294455);
    if (dir === 'W') p.faceA(.95, .08, .92, 24, 36, 0x294455);
  };
  // Desenha primeiro o que fica atrás na tela.
  if (dir === 'E') { paint(); cab(); } else { cab(); paint(); }
  for (const u of [.4, 2.7, 3.7]) { B(u - .16, u + .16, .96, 1.04, 0, 12, 0x101215, { edge: false }); }
  return p;
}
function bayTex(color) {
  const p = fp(2, 5, 34);
  p.top(0, 2, 0, 5, 0, (x, y) => shade(0x3a3d42, .9 + hash(x >> 1, y >> 1) * .14));
  p.hazard(0, .16, 0, 5); p.hazard(1.84, 2, 0, 5);
  for (let b = .9; b < 4.6; b += 1) p.poly([p.P(1, b - .28), p.P(.62, b + .08), p.P(.8, b + .08), p.P(1, b - .1), p.P(1.2, b + .08), p.P(1.38, b + .08)], color);
  p.box(.3, 1.7, .08, .22, 0, 9, 0xe6b422);              // batente de parada
  p.box(.02, .14, .05, .17, 0, 30, color); p.box(1.86, 1.98, .05, .17, 0, 30, color);
  p.box(.02, 1.98, .05, .15, 30, 34, 0x2b2f34, { edge: false });
  return p;
}

export function buildZoneFloor(scene, z) {
  const cw = (z.w + z.h) * 32, ch = (z.w + z.h) * 16 + 2, p = new Pix(cw, ch, z.h * 32, 0);
  const lamps = [];
  for (let a = 3; a < z.w; a += 6) for (let b = 2; b < z.h; b += 4) lamps.push([a, b]);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = x + .5 - p.ox, sy = y + .5, ia = (sx / 32 + sy / 16) / 2, ib = (sy / 16 - sx / 32) / 2;
    if (ia < 0 || ib < 0 || ia >= z.w || ib >= z.h) continue;
    const n = hash(x + z.x * 37, y + z.y * 13), n2 = hash(Math.floor(ia * 4), Math.floor(ib * 4)), fa = ia % 1, fb = ib % 1;
    let c = z.tint, f = .88 + n * .08 + n2 * .06;
    if (fa < .025 || fb < .025) f *= .86;
    if (Math.floor(ia) % 4 === 0 && fa < .04 || Math.floor(ib) % 4 === 0 && fb < .04) f *= .84;
    if (z.id === 'prod' && ib >= 4.05 && ib < 5.95) c = 0x4e6a60; // corredor de pedestres
    if (z.id === 'prod' && ((ib >= 4 && ib < 4.14) || (ib >= 5.86 && ib < 6))) { c = 0xe6b422; f = .92 + n * .08; }
    if (ia < .18 || ib < .18 || ia > z.w - .18 || ib > z.h - .18) { c = ((Math.floor((ia + ib) * 2)) & 1) ? 0xe6b422 : 0x1d1f22; f = .9 + n * .1; }
    let light = 0;
    for (const [la, lb] of lamps) { const d = (ia - la) ** 2 + (ib - lb) ** 2; if (d < 12) light += (1 - d / 12) * .22; }
    p.px(x, y, shade(c, f + light));
  }
  add(scene, `floor_${z.id}`, p);
}

// Paredes em segmentos de uma célula: cada um ordena a profundidade com quem passa dos dois lados.
export function buildWallTextures(scene) {
  for (const h of [118, 56, 18]) {
    const A = new Pix(36, 16 + h + 6, 2, h + 2), B = new Pix(36, 16 + h + 6, 34, h + 2);
    A.poly([A.P(0, 0, h), A.P(1, 0, h), A.P(1, 0, 0), A.P(0, 0, 0)], (x, y) => shade(0x8a939c, .86 + hash(x >> 2, y >> 3) * .12));
    B.poly([B.P(0, 0, h), B.P(0, 1, h), B.P(0, 1, 0), B.P(0, 0, 0)], (x, y) => shade(0x7a838d, .86 + hash(x >> 2, y >> 3) * .12));
    if (h > 18) {
      const z0 = h * .52, z1 = h * .8;
      A.poly([A.P(.14, 0, z1), A.P(.86, 0, z1), A.P(.86, 0, z0), A.P(.14, 0, z0)], 0xbad8e6);
      B.poly([B.P(0, .14, z1), B.P(0, .86, z1), B.P(0, .86, z0), B.P(0, .14, z0)], 0xa9cad9);
    }
    A.poly([A.P(0, 0, h), A.P(.08, 0, h), A.P(.08, 0, 0), A.P(0, 0, 0)], 0x4a525b);
    B.poly([B.P(0, 0, h), B.P(0, .08, h), B.P(0, .08, 0), B.P(0, 0, 0)], 0x424a53);
    A.poly([A.P(0, 0, 9), A.P(1, 0, 9), A.P(1, 0, 0), A.P(0, 0, 0)], 0x3c4249);
    B.poly([B.P(0, 0, 9), B.P(0, 1, 9), B.P(0, 1, 0), B.P(0, 0, 0)], 0x343a41);
    add(scene, `wallA_${h}`, A); add(scene, `wallB_${h}`, B);
  }
}

export function buildAllTextures(scene) {
  buildWallTextures(scene);
  const s1 = (fn, key, frames) => { for (let f = 0; f < frames; f++) { const p = fp(2, 2, 70); fn(p, f); add(scene, `${key}_${f}`, p); } };
  s1(station1, 'st1', 4); s1(station2, 'st2', 4); s1(station3, 'st3', 4);
  for (let i = 0; i <= 4; i++) {
    let p = fp(4, 3, 70); depot(p, i / 4); add(scene, `depot_${i}`, p);
    p = fp(4, 3, 70); dock(p, i / 4); add(scene, `dock_${i}`, p);
  }
  for (let i = 0; i <= 6; i++) { const p = fp(2, 2, 44); pallet(p, i); add(scene, `pallet_${i}`, p); }
  { const p = fp(3, 2, 60); rest(p); add(scene, 'rest_0', p); }
  for (const k of Object.keys(ART)) for (let f = 0; f < 4; f++) { const p = fp(2, 2, 72); ART[k](p, f); add(scene, `${k}_${f}`, p); }
  for (let f = 0; f < 4; f++) {
    add(scene, `belt_E_${f}`, beltTex('a', false, f)); add(scene, `belt_W_${f}`, beltTex('a', true, f));
    add(scene, `belt_S_${f}`, beltTex('b', false, f)); add(scene, `belt_N_${f}`, beltTex('b', true, f));
    add(scene, `split_${f}`, splitterTex(f));
  }
  for (const st of [1, 2, 3]) add(scene, `item_${st}`, itemTex(st));
  for (const role of Object.keys(ROLE_COLOR)) for (const back of [0, 1]) for (let f = 0; f < 5; f++) for (let sk = 0; sk < 3; sk++) {
    add(scene, `w_${role}_${back}_${f}_${sk}`, workerTex(role, back, f, sk));
  }
  for (const back of [0, 1]) for (const l of [0, 1]) add(scene, `fork_${back}_${l}`, forkTex(back, l));
  for (const d of ['W', 'E', 'N']) add(scene, `truck_${d}`, truckTex(d));
  add(scene, 'bayIn_0', bayTex(0x4f9bd0)); add(scene, 'bayOut_0', bayTex(ORANGE));

  // Pequenos elementos de efeito
  const glow = document.createElement('canvas'); glow.width = glow.height = 256;
  const g = glow.getContext('2d'), rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,240,205,.8)'); rg.addColorStop(1, 'rgba(255,240,205,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  scene.textures.addCanvas('glow', glow);
  const spark = new Pix(3, 3); spark.rect(0, 0, 3, 3, 0xffd166); add(scene, 'spark', spark);
  const pixel = new Pix(2, 2); pixel.rect(0, 0, 2, 2, 0xffffff); add(scene, 'pixel', pixel);
  const carry = new Pix(10, 10); carry.rect(0, 1, 10, 9, CARD); carry.rect(0, 1, 10, 1, shade(CARD, 1.25)); carry.rect(4, 1, 2, 9, 0xe3d1ae); add(scene, 'carry', carry);
  const alert = new Pix(20, 20); alert.poly([[10, 1], [19, 18], [1, 18]], 0xd93636); alert.rect(9, 7, 2, 6, 0xffffff); alert.rect(9, 14, 2, 2, 0xffffff); add(scene, 'alert', alert);
  const sel = new Pix(2, 2); add(scene, 'empty', sel);
  return GAME;
}
