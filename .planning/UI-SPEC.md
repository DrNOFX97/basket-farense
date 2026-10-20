# UI-SPEC

## Principio

Interface de dados. O numero manda, o cromo nao. Preto e branco porque sao as
cores do clube; verde e vermelho so com significado (vitoria e derrota).

## Tokens

Cor
- --bg          #08090B   fundo da pagina
- --surface     #101216   cartoes
- --surface-2   #16191F   cabecalhos de tabela, hover
- --line        #22262E   bordas
- --tx          #F3F5F8   texto principal
- --tx-2        #A2AAB8   texto secundario
- --tx-3        #6C7482   legendas
- --win         #35D07F
- --loss        #FF5D5D
- --live        #35D07F
- --accent      #FFFFFF   accao principal e seleccao

Tipografia
- familia: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial
- numeros: font-variant-numeric: tabular-nums
- escala: 11 / 12 / 13 / 14 / 16 / 20 / 28 / 40 px
- titulos com letter-spacing negativo a partir de 20 px

Espaco: 4 / 8 / 12 / 16 / 24 / 32 / 48
Raio: 8 (controlos) / 12 (cartoes) / 999 (pills)
Borda: 1 px --line em tudo o que e superficie

## Layout

- >= 1024 px: sidebar fixa de 280 px, conteudo com max-width 1180 px.
- < 1024 px: barra superior fixa com dropdown de escalao; tabs horizontais
  com scroll; conteudo a largura total.
- Tabelas largas fazem scroll horizontal dentro do cartao, nunca no body.

## Componentes

- Sidebar: marca, selector de epoca, lista de escaloes agrupada por seniores e
  formacao, rodape com estado do modo ao vivo.
- HeaderEscalao: nome, competicao, saldo V-D, posicao.
- Tabs: Resumo, Jogos, Classificacao, Plantel.
- CartaoResultado: data, adversario, casa/fora, resultado, parciais.
- Placar: equipas, marcador grande, periodo, relogio.
- TabelaDados: cabecalho sticky, primeira coluna a esquerda, resto numerico.
- EstadoVazio, EstadoCarregando (skeleton), EstadoErro.

## Movimento

- Transicoes de 120 a 180 ms.
- Hover em linhas de tabela clicaveis.
- Pulso no indicador de jogo a decorrer.
- Respeitar prefers-reduced-motion.

## Acessibilidade

- Contraste minimo 4.5:1 no texto.
- Foco visivel em todos os controlos.
- Tabelas com <th scope="col">.
- Navegacao por teclado nos cartoes de jogo (button, nao div).
