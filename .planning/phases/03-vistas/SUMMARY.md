# Fase 03 — Vistas

## Objectivo

As cinco vistas de consulta, com estados de vazio, tabelas ordenáveis e
navegação por teclado.

## O que foi feito

- `views/resumo.js` — próximo jogo com contagem decrescente, último resultado
  com parciais e forma, mini-classificação (top 6 + linha própria quando está
  fora), melhores marcadores e grelha de indicadores da época.
- `views/jogos.js` — lista agrupada por mês, com filtros e contagem por filtro.
- `views/jogo.js` — marcador, parciais, liderança, comparação por barras,
  boxscore das duas equipas com linha de total e play-by-play filtrável com
  marcador corrido.
- `views/classificacao.js` — tabela completa, linha do Farense destacada.
- `views/plantel.js` — agregação por jogador, ordenação por qualquer coluna
  (ascendente/descendente, com `aria-sort`), linha de total.
- `data.js` — derivações: jogos realizados/futuros, próximo, último, forma,
  estatísticas por jogador, totais por jogo e por época, nomes por fid.

## Decisões

- **Vistas como objectos `{ render, mount }`.** `render` devolve HTML;
  `mount` liga eventos e pode devolver uma função de limpeza (usada pelo modo
  ao vivo). Evita um framework e mantém cada vista testável fora do browser.
- **Delegação de eventos no contentor.** As listas são re-renderizadas sem
  voltar a ligar listeners.
- **Tudo escapado.** `esc()` em todos os valores vindos da API. Nomes de
  equipas e jogadores têm aspas e acentos à vontade.
- **Datas sem conversão de fuso.** A API devolve `Z` mas o valor é a hora local
  do pavilhão; converter deslocava os jogos uma hora.

## Correcções feitas durante a fase

- Coluna "Equipa" estava alinhada à direita (só a primeira coluna era
  alinhada à esquerda). Passou a haver `th.name`/`td.name` alinhados à
  esquerda.
- A grelha de 1 coluna em mobile permitia que as tabelas esticassem a página:
  `grid-template-columns: minmax(0, 1fr)` e `min-width: 0` nos cartões.
- O select de época no mobile era espremido pelo select de escalão
  (`width: 100%` dentro de um flex). Passou a `flex: 1 1 0; width: auto`.
- **Percentagens de lançamento eram falsas.** Ver Fase 05.

## Verificação

- `scripts/check-views.mjs`: 141 combinações vista × equipa × jogo, todas sem
  HTML vazio, `undefined`, `NaN` ou `[object Object]`.
- Capturas em Chrome headless a 1440 px e a 390 px (via iframe, porque o
  headless no Windows não desce abaixo de ~500 px de janela).
- Píxeis do PNG descodificados em Python para confirmar que artefactos vistos
  nas capturas não existiam no DOM.
