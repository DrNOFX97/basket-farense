# ACTION_PLAN

Branch `ui-audit`. Esforço: B baixo · M médio · A alto. Impacto UX: ↑ baixo · ↑↑ médio · ↑↑↑ alto.

## P0 — Bloqueios (feito)
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| UTF-8 em `serve.py`/`live.py`/`build_data.py` | local/Windows | B | ↑↑↑ | feito `558bd70` |
| Erro de dados com causa, 2 tentativas e "Tentar de novo" | todas | B | ↑↑ | feito `558bd70` |

## P1 — Estrutura por plataforma (feito)
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| Tab Bar inferior (5 destinos) | mobile | M | ↑↑↑ | feito `d104159` |
| Plantel e classificação em cards + ordenar por seletor | mobile | M | ↑↑↑ | feito `d93b39a` |
| Chips do cabeçalho numa linha | mobile | B | ↑↑ | feito `d93b39a` |
| Layout tablet 768–1023 px | tablet | B | ↑↑ | feito `7fe382f` |
| Atalhos de teclado + painel de ajuda | desktop | M | ↑↑ | feito `cd75c34` |
| Sheet de escalão (no lugar do `<select>`), com arrastar para fechar | mobile | M | ↑↑ | feito |
| Swipe-back no detalhe de jogo (arrastar desde a borda esquerda) | mobile | M | ↑↑ | feito |

## P2 — Design system e Liquid Glass (feito)
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| Tokens semânticos + tema claro/escuro + alternador | todas | M | ↑↑↑ | feito `8ea3408` |
| Vidro (blur + saturação) só na Tab Bar; superfícies neutras no desktop | mobile/desktop | B | ↑↑ | feito |
| `prefers-reduced-transparency` / `prefers-contrast` | todas | B | ↑ | feito |

## P3 — Polimento
| Item | Plataforma | Esforço | Impacto | Estado |
|---|---|---|---|---|
| Skeleton de arranque + animação de entrada das vistas | todas | B | ↑↑ | feito |
| Pull-to-refresh nas vistas Jogos/Ao vivo | mobile | M | ↑ | por fazer |
| Estados vazios ilustrados | todas | B | ↑ | por fazer (existem em texto) |
| Medir Lighthouse mobile (4G) e leitor de ecrã | todas | B | — | por fazer |

## Extra pedido
- Remoção da época 2025/2026 (dados, extractor, seletor escondido com uma só época).

## Melhorias do ao vivo e do jogo (branch `melhorias-live`)
| Item | Estado |
|---|---|
| 1. Ao vivo sem próximos jogos (`live.py`, `live.mjs`, `serve.py`, vista); gráficos SVG de marcador, parciais e liderança | feito |
| `live.py` alinhado com `live.mjs` (janela horária -30 min/+4 h, agenda a cada 30 s em jogo) | feito |
| 2. Painel Comparação / Fluxo do jogo / Líderes com filtro de período, no jogo e no Ao vivo | feito |
| 3. Tempo em campo, quintetos, faltas por período e em risco, lances livres por jogador, descontos de tempo | feito (só no detalhe de jogo; não no Ao vivo) |
| 4. Cartão de jogador (sheet em mobile, painel lateral em desktop) | feito |
| 5. Autenticação sem palavra-passe | **não funciona**, ver abaixo |
| 6. Campos extra de `Action` | `sequence` aproveitado; o resto vazio, ver abaixo |
| Corrigido: `F.relogio` lia ações a menos de 36 s do fim como segundos (mostrava 82:32) | feito |
| Corrigido: comentário falso em `totaisEquipa` (falhados de campo "reconstruídos") | feito |

### Resultado do ponto 5: token anónimo
Testado em 2026-11-01 com a chave Firebase que já está em `swish_client.py`:
`POST identitytoolkit.googleapis.com/v1/accounts:signUp?key=…` com `{"returnSecureToken": true}`, sem email nem palavra-passe.
Resposta: **HTTP 400, `ADMIN_ONLY_OPERATION`**. O registo anónimo está desativado no projeto Firebase da NBN23, por isso não há `idToken` anónimo e nem se chegou a testar o GraphQL. Não se insistiu nem se tentaram variantes. `signInWithPassword` com `SWISH_EMAIL`/`SWISH_PASSWORD` continua a ser o único caminho; `README.md`, `.env.example` e o workflow ficam como estavam.

### Resultado do ponto 6: campos extra de `Action`
Sonda só de leitura em 10 jogos recentes (um por escalão), 2572 ações:

| Campo | Preenchido | Uso |
|---|---|---|
| `sequence` | 2572/2572 (inteiros consecutivos, ordem de registo na mesa) | **usado** (índice 11 das ações) |
| `matchTime` | 100 % | igual ao instante já calculado de `período` + `tempo` (diferença 0 nas 2572): redundante, não pedido |
| `createdAt`, `updatedAt` | 100 % | `createdAt` já existia; `updatedAt` igual a ele nos exemplos |
| `isEdited` | 7/2572 true | já existia |
| `position` | sempre `[0, 0]` | vazio |
| `zone` | sempre 0 | vazio |
| `isMarked` | sempre false | vazio |
| `videoSyncSeconds` | sempre nulo | vazio |

Lançamentos de campo falhados no log: **0** (431 convertidos de 2 e 3 pontos; lances livres: 185 convertidos, 232 falhados). Confirma que não há percentagem de campo possível.

Efeito da `sequence`: desempata ações ao mesmo relógio. O +/- calculado das substituições passou de 448/689 para 683/689 jogadores iguais ao boxscore, e as divergências de minutos de 11 para 5. Com isso o +/- e os minutos dos Líderes seguem o filtro de período. Os 6 jogadores que ainda diferem estão em jogos com o log de substituições incoerente.
`build_data.py`, `live.py` e `live.mjs` pedem `sequence`; os JSON antigos (sem índice 11) continuam a funcionar com a hora de criação como desempate.

### Por fazer
- Cartões de análise extra (tempo em campo, quintetos, faltas, lances livres, timeouts) e cartão de jogador na vista Ao vivo.
- Medir Lighthouse mobile e testar com leitor de ecrã real (nunca medidos).
- Confirmar a unidade de `timeStatus.time` (relógio ao vivo) durante um jogo real: o código assume segundos abaixo de 36000 e ms acima.
