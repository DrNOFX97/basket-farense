# AUDIT_REPORT

Auditoria de 2026-10-20 a https://basket-farense.netlify.app/ e ao código em `app/`. Viewports: 390 px (telemóvel), 820 px (tablet), 1440 px (desktop). Estado "antes" = commit `b471c39`; "depois" = branch `ui-audit`.

## Bloqueios
- **Dados não carregam — não confirmado em produção.** `/data/farense.json` respondia 200 (1 183 791 B) e a app renderizava sem erros de consola.
- **Causa real encontrada, só em local/Windows:** `serve.py`, `live.py` e `build_data.py` liam e escreviam o JSON na codificação por omissão (cp1252) e o servidor rebentava ao arrancar (`UnicodeDecodeError`). Corrigido (UTF-8).
- O ecrã de erro dizia sempre o mesmo e não permitia repetir. Corrigido: distingue rede / HTTP / JSON inválido, tenta duas vezes, botão "Tentar de novo".

## Mobile
| Achado | Estado |
|---|---|
| A sidebar já estava escondida (<1024 px); havia barra superior + tabs com scroll | corrigido: Tab Bar inferior |
| Sem Tab Bar; destinos principais fora do alcance do polegar | corrigido |
| Tabelas largas com scroll horizontal (plantel, classificação) | corrigido: cards |
| Cabeçalho com 5 chips ocupava ~190 px antes do conteúdo | corrigido: linha deslizável (57 px) |
| `backdrop-filter` só na topbar | corrigido: Tab Bar em vidro com fallback |
| Troca de escalão em `<select>` nativo | corrigido: sheet de baixo com Séniores/Formação, registo e seleção marcada |
| Detalhe de jogo sem swipe-back; sem pull-to-refresh | por fazer |

## Desktop
- Sidebar com agrupamento Séniores/Formação e estado ativo: adequada.
- Ordenação por coluna no plantel e resumo em duas colunas: já existiam.
- Sem atalhos de teclado → adicionados (`g`+letra, `[` `]`, `t`, `?`).
- Sem filtros nas tabelas de classificação/plantel e sem paginação: por avaliar (listas curtas, ≤ 20 linhas).

## Transversal
- Um único breakpoint (1024 px); tablet recebia o layout de telemóvel esticado → corrigido: 768–1023 px com sidebar de 232 px; Tab Bar só < 768 px.
- Cores fixas (`#fff`, `rgba(255,255,255,…)`) espalhadas pelo CSS impediam tema claro → tokens semânticos (ver `DESIGN_SYSTEM.md`).
- Jornadas idênticas nos três tamanhos; só a apresentação muda (tabela ↔ cards).

## Funcionalidades (6 vistas)
Resumo, Jogos, Detalhe de jogo, Classificação, Plantel, Ao vivo. Todas acessíveis nos três tamanhos; `scripts/check-views.mjs` corre cada vista × equipa × jogo (66/66 após remover a época 2025/26) e falha com `undefined`/`NaN`/HTML vazio. Estados vazios existem (`.empty`). A app é só de leitura, sem persistência de utilizador (apenas o tema, em `localStorage`).

## Acessibilidade e qualidade técnica
- Contraste medido (texto vs fundo): escuro 5,5–18,2:1, claro 4,85–16,5:1 — AA cumprido. `--tx-3` no escuro estava abaixo de AA (≈4,0) e foi subido.
- Foco visível (`:focus-visible`), link "Saltar para o conteúdo", `aria-current` nas navegações, `aria-sort` nas colunas.
- Sem overflow horizontal em 390 / 767 / 768 / 820 / 1023 / 1024 / 1440 px.
- `viewport` correto (`width=device-width, initial-scale=1, viewport-fit=cover`); safe area aplicada na Tab Bar.
- **Não medido:** performance em 4G simulada (Lighthouse) e leitor de ecrã real. Ficam como verificação pendente.
