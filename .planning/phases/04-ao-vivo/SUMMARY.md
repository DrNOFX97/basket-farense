# Fase 04 — Ao vivo

## Objectivo

Mostrar o jogo a decorrer sem recarregar a página, e degradar com elegância
quando não há jogos.

## O que foi feito

- `live.py` — classe `Estado`:
  - cache de calendários durante 5 minutos (16 pedidos por ciclo, não por
    segundo)
  - só consulta o detalhe dos jogos em estado `LIVE`
  - ciclo de 4 s com jogo a decorrer, 25 s sem jogos
  - constrói `{atualizado, jogos, proximos, erro}`
- `/api/live` no `serve.py`, sempre a devolver o último instantâneo (nunca
  bloqueia o pedido à espera da API).
- `views/aovivo.js` — marcador, período, relógio, parciais e últimas 15 acções;
  sem jogos, lista os próximos encontros com contagem decrescente.
- Indicador "Ao vivo" na sidebar, alimentado por um evento
  `swish:live` disparado pela vista e por uma verificação periódica do shell.

## Decisões

- **Polling, não push.** A API não tem `subscriptionType` (verificado na
  introspecção: 178 tipos, 51 campos de `Query`, `subscriptionType: null`) e o
  bundle da app não tem WebSocket, socket.io, SSE, Pusher nem Realtime
  Database. Polling é a única opção.
- **Polling no servidor, não no cliente.** Um único consumidor da API serve
  todos os separadores abertos, e o token nunca chega ao browser.
- **Filtro por `teamFid`.** Os identificadores de escalão repetem-se entre
  épocas; o `teamFid` é estável e é o que o cliente usa para decidir se um
  jogo é "deste" escalão.
- **Falha silenciosa.** Se a API estiver em baixo, a app continua a funcionar
  com os dados estáticos e mostra o erro só na vista ao vivo.

## Verificação

- `/api/live` devolveu `atualizado: "2026-10-20 02:44:03"`, 0 jogos ao vivo e
  24 jogos futuros, em ~20 s após o arranque.
- Cada jogo futuro traz `equipa.teamFid`, confirmado em 10 escalões distintos.
- Vista ao vivo capturada em Chrome headless com dados reais.
