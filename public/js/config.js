// Todos os valores são fictícios e configuráveis. Nenhum representa dado real da fabricante.
export const GAME = {
  title: 'STIHL Factory Simulator',
  version: '0.1.0',
  saveKey: 'stihl-factory-sim-save-v1',
  tick: 1 / 30,          // passo fixo da simulação (s)
  hourSeconds: 45,       // 1 hora de jogo = 45 s reais na velocidade 1x
  shiftHours: 8,         // expediente por dia
  startHour: 8,
  startCash: 500000,
  hall: { w: 20, h: 14 },
  hallMax: { w: 32, h: 20 },
  expansionCost: 90000,  // por ampliação de 4 colunas
  tariff: 0.85,          // R$/kWh
  overheadDay: 1800,     // aluguel e custos fixos por dia
  freightIn: 150,
  freightOut: 220,
  deliverySeconds: 20,
  shipSeconds: 14,
};

export const COMPONENTS = {
  carcaca:    { name: 'Carcaça',             price: 120, color: '#8a93a1' },
  motor:      { name: 'Kit do motor',        price: 420, color: '#c9722e' },
  carburador: { name: 'Carburador',          price: 95,  color: '#c8b04a' },
  partida:    { name: 'Sistema de partida',  price: 70,  color: '#5f8fb5' },
  sabre:      { name: 'Sabre',               price: 85,  color: '#b8c0c9' },
  corrente:   { name: 'Corrente',            price: 65,  color: '#6c7682' },
  parafusos:  { name: 'Kit de parafusos',    price: 3,   color: '#9aa56a' },
  embalagem:  { name: 'Embalagem',           price: 15,  color: '#b58d5a' },
};

export const MODELS = {
  'MS 170': { unlocked: true,  price: 1650, cost: 885,  parts: 11, complexity: 1, demand: 1.0 },
  'MS 180': { unlocked: false, price: 1980, cost: 1090, parts: 13, complexity: 1.2, demand: .85 },
  'MS 250': { unlocked: false, price: 2850, cost: 1610, parts: 17, complexity: 1.5, demand: .7 },
  'MS 260': { unlocked: false, price: 3900, cost: 2240, parts: 20, complexity: 1.8, demand: .55 },
  'MS 382': { unlocked: false, price: 5600, cost: 3280, parts: 24, complexity: 2.2, demand: .4 },
  'MS 661': { unlocked: false, price: 9400, cost: 5650, parts: 28, complexity: 2.8, demand: .25 },
};

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
  st1:   { name: 'Estação 1', cost: 38000, w: 2, h: 2, kwRun: 14, kwIdle: 2, desc: 'Motor e carcaça. Inicia a motosserra.' },
  st2:   { name: 'Estação 2', cost: 32000, w: 2, h: 2, kwRun: 10, kwIdle: 2, desc: 'Combustível e partida.' },
  st3:   { name: 'Estação 3', cost: 45000, w: 2, h: 2, kwRun: 12, kwIdle: 2, desc: 'Corrente, inspeção e embalagem.' },
  pallet:{ name: 'Fim de linha', cost: 6000, w: 2, h: 2, cap: 6, desc: 'Recebe motosserras embaladas para a empilhadeira.' },
  depot: { name: 'Depósito', cost: 60000, w: 4, h: 3, cap: 600, desc: 'Guarda 600 componentes.' },
  dock:  { name: 'Expedição', cost: 50000, w: 4, h: 3, cap: 120, desc: 'Guarda 120 motosserras prontas para envio.' },
  rest:  { name: 'Área de descanso', cost: 12000, w: 3, h: 2, desc: 'Funcionários cansados recuperam a fadiga aqui.' },
};

export const ROLES = {
  assembler: { name: 'Montador', salary: 290, speed: 2.5, hireCost: 800 },
  stock:     { name: 'Almoxarife', salary: 240, speed: 2.8, hireCost: 800 },
  fork:      { name: 'Operador de empilhadeira', salary: 310, speed: 3.2, hireCost: 2500 },
  tech:      { name: 'Técnico de manutenção', salary: 420, speed: 3, hireCost: 1500 },
};

export const RESEARCH = {
  pneumatic: { name: 'Ferramentas pneumáticas', cost: 70000, seconds: 180, desc: 'Ciclo das estações 15% mais rápido.' },
  pokayoke:  { name: 'Dispositivos à prova de erro', cost: 55000, seconds: 150, desc: 'Reduz os defeitos pela metade.' },
  lube:      { name: 'Lubrificação programada', cost: 40000, seconds: 120, desc: 'Máquinas se desgastam 30% mais devagar.' },
  fastbelt:  { name: 'Esteiras de alta velocidade', cost: 30000, seconds: 100, desc: 'Esteiras 40% mais rápidas.' },
};

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
