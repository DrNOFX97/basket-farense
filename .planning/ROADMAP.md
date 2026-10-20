# Roadmap

## Fase 01 — Dados
Extrair da API tudo o que a app precisa e normalizar num unico JSON.
Inclui: equipas por epoca, identificacao de escalao e genero, jogos, boxscores,
accoes, classificacoes e agregados. Cache local das respostas cruas.

## Fase 02 — Shell da aplicacao
Servidor estatico em Python, esqueleto HTML, sistema de design (tokens CSS),
layout responsivo com sidebar em desktop e dropdown em mobile, routing por hash.

## Fase 03 — Vistas
Resumo, Jogos, Detalhe de jogo, Classificacao e Plantel, com estados de vazio,
carregamento e erro. Tabelas ordenaveis e navegacao por teclado.

## Fase 04 — Ao vivo
Endpoint `/api/live` com polling no servidor e actualizacao no cliente sem
recarregar. Indicador de estado, contagem decrescente para o proximo jogo e
degradacao graciosa quando nao ha jogos.

## Fase 05 — Verificacao
Servidor a responder em todas as rotas, JSON valido, sintaxe JS verificada com
node do Windows, e revisao de acessibilidade e contraste.
