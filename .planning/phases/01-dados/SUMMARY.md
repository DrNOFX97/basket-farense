# Fase 01 — Dados

## Objectivo

Ter, em disco, tudo o que a aplicação precisa, num único JSON normalizado, com
cache das respostas cruas para permitir reconstruções sem voltar à API.

## O que foi feito

- Cliente GraphQL (`swish_client.py`) com login Firebase, cache de token e
  renovação automática em 401.
- Extracção por equipa: competição, calendário, classificação, agregados,
  plantel, boxscores e acções de cada jogo.
- Normalização para `data/farense.json`:
  `epocas → equipas → {resumo, classificacao, agregado, plantel, jogos}`.
- Classificador de escalão/género a partir do nome da competição
  (`Sub 16 Femininos`, `U10 Basket`, `Sub 14 Masculinos 2ª Divisão`, …).
- Desambiguação de identificadores quando duas equipas partilham nome curto na
  mesma época (`sub16-f` vs `sub16-f-festival`, `sub18-m-a` vs `sub18-m-b`).

## Decisões

- **Um jogo, um registo.** Os jogos aparecem na equipa, não numa lista global;
  a navegação é sempre por escalão.
- **Acções em array posicional** `[periodo, tempo, fid, tipoActor, code,
  subCode, valor, resultado, teamFid]` em vez de objectos com chaves: o
  ficheiro final fica 40% mais pequeno e o JavaScript lê-o directamente.
- **Misses reconstruídos a partir das acções** — decisão posteriormente
  corrigida, ver "Correcções".

## Correcções feitas durante a fase

- `x-package-version` tem de ser `2.10.0` (string de versão), não o número de
  build `332`: a API responde `Invalid Version: 332`.
- `teamSchedule` devolve `homeTeam.id`, não `fid`. Comparar por `fid` fazia
  todos os jogos parecerem fora.
- A classificação não usa `games/wins/points`; usa
  `playedMatches/wonMatches/lostMatches/pointsPerGame/opponentsPointsPerGame`.
  Os totais são derivados das médias × jogos.
- `timePlayed` está em segundos, `action.time` em milissegundos.
- Campos de metadados em `BoxscoreStats` (`playerFid`, `teamFid`, …) vêm a
  `null` e anulam o objecto `stats` inteiro — nunca são pedidos.

## Verificação

- 16 equipas, 166 jogos, 61 com boxscore e play-by-play.
- `data/farense.json` = 1146 KB, válido, sem `null` inesperados nos campos
  usados pelo interface.
