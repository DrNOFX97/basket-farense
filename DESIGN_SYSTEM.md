# DESIGN_SYSTEM

Consolida `.planning/UI-SPEC.md` com o que está implementado em `app/css/app.css`. Identidade: preto e branco (cores do clube); verde e vermelho só com significado (vitória/derrota); no gráfico de pontos, dourado para marcados e vermelho para sofridos. Um sistema, dois temas, três faixas de ecrã.

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
| `--gold` | #E3B341 | #B8860B | pontos marcados no gráfico |
| `--bar`, `--glass`, `--glass-line`, `--glass-shadow` | translúcidos escuros | translúcidos claros | topbar e Tab Bar |
| `--bg-side` | #0A0B0E | #ECEEF2 | sidebar |

Regra: nenhuma cor literal fora de `:root`; usar sempre tokens.

Tipografia: `system-ui, -apple-system, "Segoe UI", Roboto…` (SF Pro em iOS); `font-variant-numeric: tabular-nums` nos números; escala 11/12/13/14/16/20/28/40 px.
Espaço 4/8/12/16/24/32/48 · Raios 8 (controlos) / 12 (cartões) / 16 / 999 (pills) · Borda 1 px `--line`.

## Breakpoints
| Faixa | Navegação | Conteúdo |
|---|---|---|
| < 768 px (telemóvel) | topbar com selects + **Tab Bar** inferior em vidro | coluna única, cards em vez de tabelas (plantel, classificação), faixa de números do cabeçalho em 2×2 |
| 768–1023 px (tablet) | sidebar 232 px + separadores no topo | tabelas, grelhas a 1 coluna |
| ≥ 1024 px (desktop) | sidebar 288 px + separadores no topo, atalhos de teclado | tabelas, multi-coluna, largura máx. 1180 px |

## Variantes por plataforma
- **Mobile:** materialidade tipo iOS — Tab Bar cápsula (`backdrop-filter: blur(24px) saturate(180%)`, fallback sólido), alvos ≥ 44 px (Tab Bar 52 px), `env(safe-area-inset-bottom)`, listas agrupadas.
- **Desktop/tablet:** superfícies neutras sem vidro, tabelas com ordenação, foco visível, atalhos (`g`+`r/j/c/p/l`, `[` `]`, `t`, `?`).

## Componentes base
`.card` · `.hstats`/`.hstat` (faixa de números do escalão) · `.tlogo`/`.tname` (logos de clube) · `.pavatar`/`.pname` (caras de jogador) · `.tabs`/`.tab` · `.tb` (Tab Bar) · `.sheet` (sheet de escalão) · `.select` · `.btn` · `.theme-btn` · `kbd` · `dialog.ajuda` · `table` + `.tw` (scroll dentro do cartão) · `.cards-m` (`.pcard`, `.ccard`) · `.skel` · `.empty` · `.aviso`.

## Avatares de jogador
`avatar(foto, nome, classe)` em `app/js/ui.js` desenha um círculo com a foto e as iniciais por baixo. Se `foto` vier vazia ou `"N/A"`, ficam só as iniciais; se o URL falhar, o handler global remove o `<img>` e as iniciais continuam visíveis. Usado no plantel (tabela e cards), nos melhores marcadores e no boxscore do jogo. Tamanhos: `.pavatar-sm` 22 px, base 28 px, `.pavatar-md` 34 px, `.pavatar-lg` 44 px. A foto vem de `Player.photo` na API; o build pede-a no roster e no boxscore de cada jogo e normaliza `"N/A"` para `null`. As fotos manuais em `app/fotos/<escalão>/` são convertidas em `fotos.json` (`npm run fotos`) e têm prioridade sobre as da API.

## Gráficos
`app/js/charts.js` gera SVG sem dependências. `linhaPontos(jogos, largura)` desenha duas linhas jogo a jogo: dourada (`--gold`) com os pontos marcados e vermelha (`--loss`) com os sofridos. O eixo Y arranca em zero e usa o maior dos dois valores; x em centros de faixa, para os pontos não ficarem colados às bordas. Quando há espaço, cada valor aparece junto ao respetivo ponto, colocado do lado oposto ao da outra linha para os números não se sobreporem. O SVG é decorativo; o contentor `.grafico` leva `role="img"` e um `aria-label` descritivo. A vista mede a largura no `mount` e volta a desenhar com `ResizeObserver`, pelo que o texto mantém o tamanho em mobile e desktop. Legenda no cabeçalho do cartão com `.legenda` (Marcados / Sofridos).

## Movimento
Entrada de vista 280 ms (`.vista-enter`), Tab Bar com transição de 200 ms. `prefers-reduced-motion` anula todas as animações e transições.

## Tema
Segue o sistema; `data-theme` em `<html>` força claro/escuro e é guardado em `localStorage('tema')` (opcional, com `try/catch`). Um script inline no `<head>` aplica-o antes da primeira pintura.

## Preferências do sistema
- `prefers-reduced-motion`: sem animações nem transições.
- `prefers-reduced-transparency`: topbar, Tab Bar e sheet passam a superfícies sólidas, sem `backdrop-filter`.
- `prefers-contrast: more`: bordas e texto secundário/terciário mais fortes, nos dois temas.

## Gestos (mobile)
Swipe-back no detalhe de jogo (arrastar ≥ 90 px desde a borda esquerda); arrastar o puxador da sheet de escalão ≥ 90 px fecha-a.
