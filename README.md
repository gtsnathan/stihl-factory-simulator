# STIHL Factory Simulator (v0.2)

Simulação isométrica de fábrica de motosserras feita com HTML5, CSS3, JavaScript e Phaser 3.

**Projeto de fã, não oficial.** Não tem vínculo com a STIHL nem endosso da marca, não usa logotipos e todos os valores são fictícios. Os valores ficam em `public/js/config.js`.

## Como jogar

- **Mover a câmera:** arraste no piso. No computador, use também WASD ou as setas.
- **Zoom:** roda do mouse, gesto de pinça ou botões − e +.
- **Selecionar:** toque numa máquina, numa esteira ou num funcionário.
- **Construir esteira:** abra Construção, escolha Esteira e arraste no piso. Enquanto constrói, mova a câmera com dois dedos ou o botão direito do mouse.
- **Teclas:** `R` gira, `Esc` cancela a construção e `Espaço` pausa.

Uma esteira só leva peças à máquina para a qual aponta. Para sair de uma máquina, ela precisa apontar para fora.

## Rodar no computador

Os módulos JavaScript precisam de um servidor local:

```
npx serve public
```

Para abrir sem servidor, gere um único arquivo com `npm i esbuild && npm run standalone`. O resultado fica em `dist/stihl-factory-simulator.html`.

## Publicar no Cloudflare

Envie esta pasta para um repositório no GitHub e conecte-o a um Worker. O `wrangler.jsonc` já serve a pasta `public` como arquivos estáticos e não há etapa de build. Se o Cloudflare pedir um comando de deploy, use `npx wrangler deploy`.

## Estrutura

```
public/js/
  config.js            valores do jogo: modelos, componentes, prédios, cargos, pesquisas
  core/                sim.js (passo fixo e comandos), state.js, grid.js (A* e paredes), save.js, migrate.js
  systems/
    production.js      qualidade, refugo, retrabalho, OEE e gargalo
    machines.js        estações, ciclo, desgaste, falhas e reparo
    workers.js         funções, fadiga, pathfinding, contratação e treinamento
    inventory.js       depósito, compras e entregas
    logistics.js       esteiras, divisores e movimentação de peças
    sectors.js         prédios do complexo, receitas, departamentos e chamados
    trucks.js          caminhões e docas
    economy.js         pedidos, vendas, empréstimos, folha, energia e fluxo de caixa
  render/              pixel.js e textures.js (arte gerada por código), scene.js (Phaser)
  ui/                  ui.js (painéis e indicadores), charts.js
tests/sim.test.mjs     testes da simulação sem interface: node tests/sim.test.mjs
```

A simulação não depende do Phaser: ela roda em passos fixos de 1/30 s e guarda tudo num objeto JSON, que é o próprio save. Por isso o resultado é o mesmo em qualquer taxa de quadros.

## Como adicionar conteúdo

- **Nova estação ou prédio:** acrescente em `BUILDINGS` e `STATION_STAGES` no `config.js` e desenhe a arte em `render/textures.js`.
- **Novo modelo:** os outros cinco já estão em `MODELS`, bloqueados. O próximo passo é ligar cada item em produção a um modelo.
- **Novo funcionário:** acrescente em `ROLES` e crie o comportamento em `systems/workers.js`.

## Estado da versão 0.2

Pronto: três prédios separados e ampliáveis (Produção, Almoxarifado e Logística), docas onde os caminhões entram e formam fila, depósito, três estações, esteiras e divisores, cinco funcionários com pathfinding e fadiga, MS 170, compras, pedidos, mercado, manutenção, pesquisa, OEE, gráficos, empréstimos e salvamento automático.

Também pronto: complexo com terrenos numerados, oito setores de fabricação com receitas, doze departamentos com efeito na fábrica e chamados técnicos.

Próximas versões: outros modelos com lista própria de componentes, turnos, sensores, fases 2 a 5 com desbloqueios, Inspetor, Engenheiro e Supervisor.

## Licenças

Phaser 3.90.0 é distribuído sob licença MIT (`public/lib/PHASER-LICENSE.md`).
