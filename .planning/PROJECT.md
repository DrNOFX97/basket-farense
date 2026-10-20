# Farense Basket — web app

## O que e

Aplicacao web para consultar toda a informacao de basquetebol do SC Farense que
existe na plataforma NBN23 (Swish): calendario, resultados, parciais, boxscores,
play-by-play, classificacoes e estatisticas de jogadores, por escalao.

## Porque

O site da Federacao Portuguesa de Basquetebol mostra uma fraccao disto. A app
Swish tem mais, mas esta presa ao telemovel e nao permite consulta rapida nem
comparacao entre escaloes. Esta app expoe os mesmos dados em desktop e mobile.

## Utilizadores

- Quem escreve sobre o Farense (artigos, redes sociais) e precisa de numeros.
- Adeptos e familiares que querem seguir um escalao concreto.
- Treinadores que querem ver a evolucao de um jogador ao longo da epoca.

## Ambito

Dentro:
- Todos os escaloes do Farense com equipa na plataforma.
- Duas epocas (2025/2026 e 2026/2027), com selector.
- Jogos realizados e por realizar.
- Detalhe de jogo: parciais, boxscore das duas equipas, play-by-play.
- Classificacao do grupo.
- Estatisticas agregadas de jogadores.
- Modo ao vivo por polling.

Fora:
- Contas de utilizador, favoritos, notificacoes.
- Dados que a NBN23 nao regista (ressaltos, assistencias, roubos, desarmes).
- Escritoes de administracao.

## Restricoes

- Sem `pip` no WSL e sem `node` no WSL: apenas biblioteca padrao do Python e
  JavaScript sem build step.
- A API exige token Firebase e o header `x-package-version: 2.10.0`.
- Nao ha canal de push: o tempo real e por polling (5 s com jogo a decorrer).
- Credenciais ficam fora do repositorio.

## Criterios de sucesso

1. Abre com `python3 serve.py` e funciona em desktop e mobile.
2. Desktop com menu lateral de escaloes; mobile com dropdown.
3. Todas as vistas carregam sem dependencias externas.
4. Nenhum erro de consola; tabelas legiveis a 360 px de largura.
5. Modo ao vivo mostra marcador e accoes sem refrescar a pagina.
