# DESIGN_SYSTEM

Consolida `.planning/UI-SPEC.md` com o que está implementado em `app/css/app.css`. Identidade: preto e branco (cores do clube); verde e vermelho só com significado (vitória/derrota). Um sistema, dois temas, três faixas de ecrã.

## Tokens (em `:root`; tema claro em `[data-theme="light"]` e `prefers-color-scheme: light`)
| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | #08090B | #F4F5F7 | fundo da página |
| `--surface` / `-2` / `-3` | #101216 / #161920 / #1C2028 | #FFFFFF / #F0F2F5 / #E6E9EE | cartões, cabeçalhos de tabela, hover |
| `--line` / `--line-2` | #22262E / #2E3440 | #E1E4EA / #CDD2DB | bordas |
| `--tx` / `--tx-2` / `--tx-3` | #F3F5F8 / #A2AAB8 / #7F8796 | #14171C / #4B5362 / #646C7B | texto (todos ≥ 4,5:1) |
| `--accent` / `--on-accent` | #FFFFFF / #08090B | #14171C / #FFFFFF | ação principal e seleção |
| `--hl` `--hl-2` `--hl-3` | branco 7,5 / 5 / 13 % | tinta 7 / 4,5 / 10 % | hover, linha do Farense, item ativo |
| `--ser-a` / `--ser-b` | #FFFFFF / #5A6272 | #14171C / #A3ABB9 | séries de comparação (Farense / adversário) |
| `--win` / `--loss` | #35D07F / #FF5D5D | #17804F / #C73B3B | vitória / derrota (+ `-dim`) |
| `--bar`, `--glass`, `--glass-line`, `--glass-shadow` | translúcidos escuros | translúcidos claros | topbar e Tab Bar |
| `--bg-side` | #0A0B0E | #ECEEF2 | sidebar |

Regra: nenhuma cor literal fora de `:root`; usar sempre tokens.

Tipografia: `system-ui, -apple-system, "Segoe UI", Roboto…` (SF Pro em iOS); `font-variant-numeric: tabular-nums` nos números; escala 11/12/13/14/16/20/28/40 px.
Espaço 4/8/12/16/24/32/48 · Raios 8 (controlos) / 12 (cartões) / 16 / 999 (pills) · Borda 1 px `--line`.

## Breakpoints
| Faixa | Navegação | Conteúdo |
|---|---|---|
| < 768 px (telemóvel) | topbar com selects + **Tab Bar** inferior em vidro | coluna única, cards em vez de tabelas (plantel, classificação), chips numa linha |
| 768–1023 px (tablet) | sidebar 232 px + separadores no topo | tabelas, grelhas a 1 coluna |
| ≥ 1024 px (desktop) | sidebar 288 px + separadores no topo, atalhos de teclado | tabelas, multi-coluna, largura máx. 1180 px |

## Variantes por plataforma
- **Mobile:** materialidade tipo iOS — Tab Bar cápsula (`backdrop-filter: blur(24px) saturate(180%)`, fallback sólido), alvos ≥ 44 px (Tab Bar 52 px), `env(safe-area-inset-bottom)`, listas agrupadas.
- **Desktop/tablet:** superfícies neutras sem vidro, tabelas com ordenação, foco visível, atalhos (`g`+`r/j/c/p/l`, `[` `]`, `t`, `?`).

## Componentes base
`.card` · `.chip` · `.tabs`/`.tab` · `.tb` (Tab Bar) · `.select` · `.btn` · `.theme-btn` · `kbd` · `dialog.ajuda` · `table` + `.tw` (scroll dentro do cartão) · `.cards-m` (`.pcard`, `.ccard`) · `.skel` · `.empty` · `.aviso`.

## Movimento
Entrada de vista 280 ms (`.vista-enter`), Tab Bar com transição de 200 ms. `prefers-reduced-motion` anula todas as animações e transições.

## Tema
Segue o sistema; `data-theme` em `<html>` força claro/escuro e é guardado em `localStorage('tema')` (opcional, com `try/catch`). Um script inline no `<head>` aplica-o antes da primeira pintura.
