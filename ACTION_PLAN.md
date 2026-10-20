# ACTION_PLAN

Branch `ui-audit`. Esforço: B baixo · M médio · A alto. Impacto UX: ↑ baixo · ↑↑ médio · ↑↑↑ alto.

## P0 — Bloqueios (feito)
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| UTF-8 em `serve.py`/`live.py`/`build_data.py` | local/Windows | B | ↑↑↑ | feito `558bd70` |
| Erro de dados com causa, 2 tentativas e "Tentar de novo" | todas | B | ↑↑ | feito `558bd70` |

## P1 — Estrutura por plataforma (feito, exceto sheets)
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| Tab Bar inferior (5 destinos) | mobile | M | ↑↑↑ | feito `d104159` |
| Plantel e classificação em cards + ordenar por seletor | mobile | M | ↑↑↑ | feito `d93b39a` |
| Chips do cabeçalho numa linha | mobile | B | ↑↑ | feito `d93b39a` |
| Layout tablet 768–1023 px | tablet | B | ↑↑ | feito `7fe382f` |
| Atalhos de teclado + painel de ajuda | desktop | M | ↑↑ | feito `cd75c34` |
| Sheet para escalão/época (no lugar dos `<select>`) | mobile | M | ↑↑ | por fazer |
| Detalhe de jogo como push com swipe-back | mobile | A | ↑↑ | por fazer |

## P2 — Design system e Liquid Glass (feito)
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| Tokens semânticos + tema claro/escuro + alternador | todas | M | ↑↑↑ | feito `8ea3408` |
| Vidro (blur + saturação) só na Tab Bar; superfícies neutras no desktop | mobile/desktop | B | ↑↑ | feito |
| `prefers-reduced-transparency` / `prefers-contrast` | todas | B | ↑ | por fazer |

## P3 — Polimento
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| Skeleton de arranque + animação de entrada das vistas | todas | B | ↑↑ | feito |
| Pull-to-refresh nas vistas Jogos/Ao vivo | mobile | M | ↑ | por fazer |
| Estados vazios ilustrados | todas | B | ↑ | por fazer (existem em texto) |
| Medir Lighthouse mobile (4G) e leitor de ecrã | todas | B | — | por fazer |

## Extra pedido
- Remoção da época 2025/2026 (dados, extractor, seletor escondido com uma só época).
