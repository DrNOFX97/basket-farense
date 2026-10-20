# Fase 05 — Verificação

## Objectivo

Confirmar que o servidor responde, que o JSON é válido, que o JavaScript não
tem erros de sintaxe e que as vistas resistem a todos os dados reais.

## O que foi feito

- **Sintaxe:** `node --check` a todos os ficheiros de `app/js/`. Todos passam.
  Para isso foi necessário `package.json` com `"type": "module"`.
- **Teste de fumo:** `scripts/check-views.mjs` importa as vistas e corre-as
  contra `data/farense.json` — 141 combinações, incluindo todas as equipas e
  todos os jogos com resultado. Falha em HTML vazio, `undefined`, `NaN` ou
  `[object Object]`.
- **Servidor:** todas as rotas verificadas com `curl` (código, tamanho e
  `Content-Type`).
- **Layout:** capturas em Chrome headless a 1440 px e a 390 px. O headless no
  Windows não aceita janelas abaixo de ~500 px, por isso o teste a 390 px foi
  feito com um iframe de 390 px, que cria um viewport real.
- **Píxeis:** uma suspeita de caracteres estranhos nas capturas foi resolvida
  descodificando o PNG em Python (zlib) e imprimindo a região como texto. O
  DOM estava limpo; era artefacto de leitura da imagem.

## Descoberta que mudou o produto

A plataforma **só registra lançamentos de campo convertidos**. Contagem das
acções em todos os 61 jogos com play-by-play:

| code | subCode | result | ocorrências |
|---|---|---|---|
| POINTS | IN_ARC | true | 1893 |
| POINTS | IN_ARC | false | **0** |
| POINTS | OUT_ARC | true | 210 |
| POINTS | OUT_ARC | false | **0** |
| POINTS | FREE_THROW | true | 875 |
| POINTS | FREE_THROW | false | 1042 |

Ou seja: os falhados de 2 e 3 pontos não existem na fonte. As percentagens de
lançamento de campo eram, por construção, sempre 100%.

Correcções aplicadas:

- Removidas as colunas `2%` e `3%` do plantel e as percentagens de campo dos
  indicadores da época.
- `2P` e `3P` passam a mostrar apenas convertidos.
- `LL` continua a mostrar `convertidos/tentados`, porque os lances livres estão
  completos.
- A limitação está escrita na interface, junto dos números.
- `p2`, `p3`, `t2`, `t3` ficam a `null` em `data.js` para que nenhuma vista
  futura volte a calcular percentagens impossíveis.

## Estado final

- 16 equipas, 166 jogos, 61 com boxscore e play-by-play.
- 2 épocas, 10 escalões em 2026/2027 e 6 em 2025/2026.
- Nenhuma dependência externa; apenas Python 3.9+ e um browser com módulos ES.
