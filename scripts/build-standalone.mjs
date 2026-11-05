// Gera dist/stihl-factory-simulator.html: um único arquivo com jogo, Phaser e CSS.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({ entryPoints: ['public/js/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2019' });
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
let html = readFileSync('public/index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>${readFileSync('public/css/style.css', 'utf8')}</style>`);
html = html.replace('<script src="lib/phaser.min.js"></script>', () => `<script>${safe(readFileSync('public/lib/phaser.min.js', 'utf8'))}</script>`);
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script>${safe(res.outputFiles[0].text)}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/stihl-factory-simulator.html', html);
console.log(`dist/stihl-factory-simulator.html: ${(html.length / 1048576).toFixed(2)} MB`);
