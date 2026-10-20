# Fase 02 — Shell da aplicação

## Objectivo

Servidor local e esqueleto da aplicação: layout, sistema de design, navegação
e routing, antes de qualquer vista.

## O que foi feito

- `serve.py` com `ThreadingHTTPServer` da biblioteca padrão:
  - estático a partir de `app/`
  - `gzip` quando o cliente aceita
  - `/data/farense.json`, `/api/live`, `/api/meta`
  - protecção contra path traversal
  - `--port`, `--host`, `--no-live`
- `app/index.html`: sidebar (marca, selector de época, navegação, rodapé com
  indicador ao vivo), topbar mobile com dois selects, contentor, bloco de erro
  fatal e link "saltar para o conteúdo".
- `app/css/app.css`: tokens (cores, espaçamentos, raios, tipografia), layout
  com sidebar fixa de 288 px, breakpoint em 1024 px, cartões, tabelas, listas
  de jogos, marcador, barras comparativas, play-by-play, skeletons e
  `prefers-reduced-motion`.
- Routing por hash `#/<época>/<equipa>/<vista>[/<fid>]`, com normalização de
  URLs inválidas e `history.replaceState`.

## Decisões

- **Sem build step.** `node` não existe no WSL e `npm install` traria uma
  árvore de dependências para servir ficheiros estáticos. Módulos ES nativos.
- **Sidebar em desktop, selects em mobile.** A lista de 16 escalões não cabe
  num dropdown de topo em desktop, e uma sidebar de 288 px não cabe num
  telemóvel. Os dois mecanismos coexistem no mesmo HTML e o CSS escolhe.
- **Preto e branco.** Cores do clube. Verde e vermelho só para vitória e
  derrota, nunca como decoração.
- **Tema escuro fixo.** Evita o flash de tema errado e reduz o CSS a metade.

## Verificação

- `/`, `/css/app.css`, `/js/app.js`, `/data/farense.json` e `/api/meta`
  respondem 200 com o `Content-Type` correcto.
- Sem overflow horizontal a 390 px (`scrollWidth` 375 num viewport de 390).
