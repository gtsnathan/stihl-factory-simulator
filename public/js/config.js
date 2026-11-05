// Todos os valores são fictícios e configuráveis. Nenhum representa dado real da fabricante.
export const GAME = {
  title: 'STIHL Factory Simulator',
  version: '0.2.0',
  saveKey: 'stihl-factory-sim-save-v1',
  tick: 1 / 30,          // passo fixo da simulação (s)
  hourSeconds: 45,       // 1 hora de jogo = 45 s reais na velocidade 1x
  shiftHours: 8,         // expediente por dia
  startHour: 8,
  startCash: 500000,
  hall: { w: 26, h: 34 }, // terreno inteiro, em células
  hallMax: { w: 72, h: 34 },
  expansionCost: 90000,  // por ampliação de 4 colunas
  tariff: 0.85,          // R$/kWh
  overheadDay: 1800,     // aluguel e custos fixos por dia
  freightIn: 150,
  freightOut: 220,
  deliverySeconds: 8,    // até o caminhão aparecer na pista
};

export const COMPONENTS = {
  carcaca:    { name: 'Carcaça',             price: 190, color: '#8a93a1' },
  motor:      { name: 'Kit do motor',        price: 780, color: '#c9722e' },
  carburador: { name: 'Carburador',          price: 95,  color: '#c8b04a' },
  partida:    { name: 'Sistema de partida',  price: 70,  color: '#5f8fb5' },
  sabre:      { name: 'Sabre',               price: 85,  color: '#b8c0c9' },
  corrente:   { name: 'Corrente',            price: 65,  color: '#6c7682' },
  parafusos:  { name: 'Kit de parafusos',    price: 3,   color: '#9aa56a' },
  embalagem:  { name: 'Embalagem',           price: 15,  color: '#b58d5a' },
  // Matérias-primas: compradas para abastecer os setores
  aluminio:   { name: 'Liga de alumínio',    price: 20,  color: '#c4ccd4', raw: true },
  aco:        { name: 'Aço',                 price: 25,  color: '#77818c', raw: true },
  plastico:   { name: 'Plástico industrial', price: 12,  color: '#d9823b', raw: true },
  quimico:    { name: 'Químicos de cromagem', price: 12, color: '#7fb6a8', raw: true },
  papelao:    { name: 'Papelão e etiquetas', price: 5,   color: '#a98655', raw: true },
  // Peças em processo: fabricadas nos setores, não são compradas
  cilBruto:   { name: 'Cilindro fundido',    color: '#8f8f8f', made: true },
  cilUsinado: { name: 'Cilindro usinado',    color: '#a5adb5', made: true },
  cilPrep:    { name: 'Cilindro preparado',  color: '#b6bfc7', made: true },
  cilCromo:   { name: 'Cilindro cromado',    color: '#dfe6ec', made: true },
  cilindro:   { name: 'Cilindro brunido',    color: '#f0f4f7', made: true },
  virabrequim:{ name: 'Virabrequim',         color: '#606a75', made: true },
  pistao:     { name: 'Pistão',              color: '#c8ced4', made: true },
  tampa:      { name: 'Tampa plástica',      color: '#e4692a', made: true },
};

export const MODELS = {
  'MS 170': { unlocked: true,  price: 1900, cost: 1315,  parts: 11, complexity: 1, demand: 1.0 },
  'MS 180': { unlocked: false, price: 1980, cost: 1090, parts: 13, complexity: 1.2, demand: .85 },
  'MS 250': { unlocked: false, price: 2850, cost: 1610, parts: 17, complexity: 1.5, demand: .7 },
  'MS 260': { unlocked: false, price: 3900, cost: 2240, parts: 20, complexity: 1.8, demand: .55 },
  'MS 382': { unlocked: false, price: 5600, cost: 3280, parts: 24, complexity: 2.2, demand: .4 },
  'MS 661': { unlocked: false, price: 9400, cost: 5650, parts: 28, complexity: 2.8, demand: .25 },
};

// Máquinas dos setores. Toda receita consome e produz estoque real; um carrinho leva e busca.
export const MACHINES = {
  forno:    { name: 'Forno de fundição', sector: 'fundicao', cost: 26000, kwRun: 60, kwIdle: 6, heat: true, desc: 'Aquece o metal. Sem 600 °C, a fundição não trabalha.' },
  diecast:  { name: 'Fundição sob pressão', sector: 'fundicao', cost: 30000, kwRun: 24, kwIdle: 3, cycle: 11, in: { aluminio: 2 }, out: 'cilBruto', defect: .04, needsHeat: true, desc: 'Alumínio vira cilindro fundido.' },
  cnc:      { name: 'Centro CNC', sector: 'usinagem', cost: 28000, kwRun: 20, kwIdle: 3, cycle: 12, in: { cilBruto: 1 }, out: 'cilUsinado', defect: .02, desc: 'Usina o cilindro fundido.' },
  torno:    { name: 'Torno industrial', sector: 'usinagem', cost: 16000, kwRun: 12, kwIdle: 2, cycle: 10, in: { aco: 1 }, out: 'virabrequim', defect: .02, desc: 'Aço vira virabrequim.' },
  fresa:    { name: 'Fresadora', sector: 'usinagem', cost: 15000, kwRun: 10, kwIdle: 2, cycle: 9, in: { aluminio: 1 }, out: 'pistao', defect: .02, desc: 'Alumínio vira pistão.' },
  acab:     { name: 'Acabamento e inspeção', sector: 'cilindros', cost: 18000, kwRun: 10, kwIdle: 2, cycle: 9, in: { cilUsinado: 1 }, out: 'cilPrep', defect: .03, desc: 'Prepara e mede o cilindro.' },
  tanque:   { name: 'Tanque de cromagem', sector: 'cromagem', cost: 24000, kwRun: 18, kwIdle: 3, cycle: 13, in: { cilPrep: 1, quimico: 1 }, out: 'cilCromo', defect: .02, waste: 7, desc: 'Gera resíduo. Com o tanque de resíduos cheio, para.' },
  residuo:  { name: 'Tratamento de resíduos', sector: 'cromagem', cost: 14000, kwRun: 8, kwIdle: 1, treat: true, desc: 'Trata o resíduo da cromagem.' },
  brunidora:{ name: 'Brunidora', sector: 'brunimento', cost: 20000, kwRun: 12, kwIdle: 2, cycle: 10, in: { cilCromo: 1 }, out: 'cilindro', defect: .03, desc: 'Dá o acabamento interno e aprova o cilindro.' },
  injetora: { name: 'Injetora de plásticos', sector: 'injecao', cost: 22000, kwRun: 18, kwIdle: 3, cycle: 8, in: { plastico: 2 }, out: 'carcaca', defect: .02, desc: 'Molde trocável: carcaça ou tampa.' },
  bancada:  { name: 'Bancada de motores', sector: 'motores', cost: 12000, kwRun: 4, kwIdle: 1, cycle: 13, in: { cilindro: 1, virabrequim: 1, pistao: 1, tampa: 1 }, out: 'motor', defect: .02, desc: 'Monta e testa o motor.' },
  robot:    { name: 'Célula robotizada', sector: 'motores', cost: 85000, kwRun: 22, kwIdle: 4, cycle: 10, role: 'none', in: { cilindro: 1, virabrequim: 1, pistao: 1, tampa: 1 }, out: 'motor', defect: .01, desc: 'Monta motores sem operador.' },
  label:    { name: 'Linha de embalagem', sector: 'embalagem', cost: 12000, kwRun: 5, kwIdle: 1, cycle: 5, in: { papelao: 1 }, out: 'embalagem', defect: .01, desc: 'Imprime etiquetas e prepara caixas.' },
  desk:     { name: 'Estações de trabalho', sector: 'any', cost: 0, kwRun: 2, kwIdle: 1, role: 'office', desk: true, internal: true, desc: 'Mesa do departamento.' },
};
for (const m of Object.values(MACHINES)) { m.outCap = 8; m.role = m.role || 'assembler'; }

const SEC = (num, name, cost, tint, desc) => ({ num, name, cost, tint, desc });
export const SECTORS = {
  prod:      SEC(50, 'Montagem final (UMP/UMG)', 150000, 0x6c7277, 'Mais uma linha de montagem final.'),
  almox:     SEC(2, 'Almoxarifado', 70000, 0x66727c, 'Espaço para mais depósitos.'),
  log:       SEC(1, 'Logística e expedição', 70000, 0x76705f, 'Espaço para mais expedição.'),
  fundicao:  SEC(11, 'Fundição', 45000, 0x6e6058, 'Fornos e fundição sob pressão.'),
  usinagem:  SEC(14, 'Usinagem', 40000, 0x5f6d78, 'CNC, tornos e fresadoras.'),
  cilindros: SEC(31, 'Cilindros (ZFA)', 35000, 0x6a6f7c, 'Acabamento e inspeção dimensional.'),
  cromagem:  SEC(32, 'Cromagem (ZCR)', 40000, 0x5d7168, 'Tanques e tratamento de resíduos.'),
  brunimento:SEC(28, 'Brunimento', 35000, 0x6c6a78, 'Acabamento interno dos cilindros.'),
  injecao:   SEC(22, 'Injeção de plásticos', 35000, 0x75695c, 'Carcaças e tampas.'),
  motores:   SEC(35, 'Montagem de motores', 35000, 0x63705f, 'Motores próprios, mais baratos que os comprados.'),
  embalagem: SEC(43, 'Embalagem', 25000, 0x786d58, 'Caixas e etiquetas próprias.'),
  manut:     SEC(5, 'Manutenção industrial', 30000, 0x6b6f72, 'Reparos 30% mais rápidos.'),
  ferram:    SEC(7, 'Ferramentaria', 30000, 0x6b6f72, 'Máquinas 8% mais rápidas e 15% menos desgaste.'),
  engprod:   SEC(9, 'Engenharia de produção', 35000, 0x6b6f72, 'Todos os ciclos 5% mais rápidos.'),
  engproc:   SEC(10, 'Engenharia de processos', 35000, 0x6b6f72, '25% menos defeitos.'),
  qualidade: SEC(12, 'Qualidade', 30000, 0x6b6f72, '20% menos defeitos e mais retrabalho em vez de refugo.'),
  ti:        SEC(3, 'TI e suporte', 30000, 0x6b6f72, 'Metade dos incidentes e libera técnicos de TI.'),
  compras:   SEC(18, 'Compras', 30000, 0x6b6f72, 'Materiais 6% mais baratos e entrega mais rápida.'),
  rh:        SEC(20, 'Recursos Humanos', 25000, 0x6b6f72, 'Contratação pela metade e 20% menos fadiga.'),
  seg:       SEC(21, 'Segurança do Trabalho', 25000, 0x6b6f72, 'Evita acidentes e interdições.'),
  ped:       SEC(25, 'Pesquisa e Desenvolvimento', 40000, 0x6b6f72, 'Pesquisas 60% mais rápidas.'),
  pcp:       SEC(26, 'PCP', 30000, 0x6b6f72, 'Libera a compra automática de matéria-prima.'),
  logint:    SEC(4, 'Logística interna', 25000, 0x6b6f72, 'Carrinhos 25% mais rápidos.'),
};
export const DEPARTMENTS = { manut: 1, ferram: 1, engprod: 1, engproc: 1, qualidade: 1, ti: 1, compras: 1, rh: 1, seg: 1, ped: 1, pcp: 1, logint: 1 };

// Terrenos do complexo, do mais próximo da fábrica inicial para o mais distante.
export const LOTS = [];
for (const [y, xs] of [[9, [0, 12, 24]], [0, [0, 12, 24]], [18, [28, 40]], [27, [28, 40]], [9, [36, 48]], [0, [36, 48]], [18, [52, 62]], [27, [52, 62]], [9, [60]], [0, [60]]]) for (const x of xs) LOTS.push({ x, y, w: 10, h: 7 });

export const STATION_STAGES = {
  st1: { stage: 1, short: 'Motor e carcaça', cycle: 14,
    mats: { carcaca: 1, motor: 1, parafusos: 2 } },
  st2: { stage: 2, short: 'Combustível e partida', cycle: 12,
    mats: { carburador: 1, partida: 1, parafusos: 2 } },
  st3: { stage: 3, short: 'Corrente, inspeção e embalagem', cycle: 16,
    mats: { sabre: 1, corrente: 1, embalagem: 1, parafusos: 1 }, inspects: true },
};

// w/h em tiles. Esteiras e divisores usam 1×1 e têm direção própria.
export const BUILDINGS = {
  belt:  { name: 'Esteira', cost: 800, w: 1, h: 1, desc: 'Leva peças de uma célula para a outra. Arraste para desenhar.' },
  split: { name: 'Divisor', cost: 2500, w: 1, h: 1, desc: 'Alterna as peças entre as esteiras de saída.' },
  st1:   { name: 'Estação 1', zone: 'prod', cost: 38000, w: 2, h: 2, kwRun: 14, kwIdle: 2, desc: 'Motor e carcaça. Inicia a motosserra.' },
  st2:   { name: 'Estação 2', zone: 'prod', cost: 32000, w: 2, h: 2, kwRun: 10, kwIdle: 2, desc: 'Combustível e partida.' },
  st3:   { name: 'Estação 3', zone: 'prod', cost: 45000, w: 2, h: 2, kwRun: 12, kwIdle: 2, desc: 'Corrente, inspeção e embalagem.' },
  pallet:{ name: 'Fim de linha', zone: 'prod', cost: 6000, w: 2, h: 2, cap: 6, desc: 'Recebe motosserras embaladas para a empilhadeira.' },
  depot: { name: 'Depósito', zone: 'almox', cost: 60000, w: 4, h: 3, cap: 600, desc: 'Guarda 600 componentes.' },
  dock:  { name: 'Expedição', zone: 'log', cost: 50000, w: 4, h: 3, cap: 120, desc: 'Guarda 120 motosserras prontas para envio.' },
  bayIn: { name: 'Doca de recebimento', zone: 'almox', cost: 40000, w: 2, h: 5, front: true, desc: 'Caminhões entram aqui para descarregar componentes. Fica na parede frontal.' },
  bayOut:{ name: 'Doca de expedição', zone: 'log', cost: 40000, w: 2, h: 5, front: true, desc: 'Caminhões entram aqui para carregar motosserras. Fica na parede frontal.' },
  rest:  { name: 'Área de descanso', zone: 'any', cost: 12000, w: 3, h: 2, desc: 'Funcionários cansados recuperam a fadiga aqui.' },
};

// Prédios iniciais. Cada porta é a célula interna por onde se atravessa a parede.
export const ZONES = [
  { id: 'prod', sector: 'prod', name: 'Prédio 50 · Montagem final (UMP/UMG)', x: 0, y: 18, w: 22, h: 7, wall: 56, tint: 0x6c7277, doors: [{ x: 5, y: 24 }, { x: 17, y: 24 }] },
  { id: 'almox', sector: 'almox', name: 'Prédio 02 · Almoxarifado', x: 0, y: 27, w: 10, h: 7, wall: 56, tint: 0x66727c, doors: [{ x: 5, y: 27 }] },
  { id: 'log', sector: 'log', name: 'Prédio 01 · Logística e expedição', x: 16, y: 27, w: 10, h: 7, wall: 56, tint: 0x76705f, doors: [{ x: 18, y: 27 }] },
];

export const ROLES = {
  assembler: { name: 'Montador/operador', salary: 290, speed: 2.5, hireCost: 800 },
  stock:     { name: 'Almoxarife (carrinho)', salary: 240, speed: 5, hireCost: 800 },
  fork:      { name: 'Operador de empilhadeira', salary: 310, speed: 3.2, hireCost: 2500 },
  tech:      { name: 'Técnico de manutenção', salary: 420, speed: 3, hireCost: 1500 },
  it:        { name: 'Técnico de TI', salary: 440, speed: 3, hireCost: 1500, needs: 'ti' },
  office:    { name: 'Analista de departamento', salary: 480, speed: 2.5, hireCost: 1200 },
};

export const RESEARCH = {
  pneumatic: { name: 'Ferramentas pneumáticas', cost: 70000, seconds: 180, desc: 'Ciclo das estações 15% mais rápido.' },
  pokayoke:  { name: 'Dispositivos à prova de erro', cost: 55000, seconds: 150, desc: 'Reduz os defeitos pela metade.' },
  lube:      { name: 'Lubrificação programada', cost: 40000, seconds: 120, desc: 'Máquinas se desgastam 30% mais devagar.' },
  fastbelt:  { name: 'Esteiras de alta velocidade', cost: 30000, seconds: 100, desc: 'Esteiras 40% mais rápidas.' },
};

for (const [k, m] of Object.entries(MACHINES)) BUILDINGS[k] = { name: m.name, cost: m.cost, w: 2, h: 2, kwRun: m.kwRun, kwIdle: m.kwIdle, zone: m.sector, desc: m.desc, machine: true };

export const PHASES = [
  { name: 'Oficina inicial', goal: 100, text: 'Montagem manual e poucos funcionários' },
  { name: 'Pequena fábrica', goal: 500, text: 'Primeiras esteiras e linhas especializadas' },
  { name: 'Indústria média', goal: 2000, text: 'Componentes próprios e controle de qualidade' },
  { name: 'Fábrica automatizada', goal: 8000, text: 'Robôs, sensores e máquinas CNC' },
  { name: 'Indústria 4.0', goal: Infinity, text: 'Automação inteligente e otimização' },
];

export const CLIENTS = ['Serra Sul Distribuidora', 'AgroMata Equipamentos', 'Casa do Lenhador', 'Norte Florestal',
  'Campo Forte Máquinas', 'Pinhal Ferramentas', 'Rio Verde Agro', 'Vale Madeira Suprimentos'];
export const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Karen', 'Luan', 'Marta', 'Nuno', 'Olga', 'Paulo', 'Rita', 'Sérgio', 'Tânia', 'Vitor'];
export const LAST_NAMES = ['Almeida', 'Borges', 'Costa', 'Dias', 'Farias', 'Gomes', 'Lima', 'Moura', 'Nunes', 'Prado', 'Ramos', 'Souza', 'Teixeira', 'Vieira'];

export const DIRS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
export const OPPOSITE = { E: 'W', W: 'E', N: 'S', S: 'N' };
export const NEXT_DIR = { E: 'S', S: 'W', W: 'N', N: 'E' };
