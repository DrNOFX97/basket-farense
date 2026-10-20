# Farense Basket

Aplicação web com o calendário, resultados, classificações e estatísticas de
**todos os escalões de basquetebol do SC Farense**, a partir dos dados da
plataforma NBN23 (Swish) usada pela Federação Portuguesa de Basquetebol.

Funciona em desktop (menu lateral) e em telemóvel (selector de escalão), sem
dependências, sem build step e sem acesso à Internet a não ser o próprio
servidor local — excepto o modo ao vivo, que fala com a API.

---

## Começar

```bash
cd "Farense Basket"
python3 serve.py
```

Abrir <http://localhost:8000>.

| Opção | Efeito |
|---|---|
| `--port 8790` | Muda a porta (por omissão 8000) |
| `--host 127.0.0.1` | Fecha o acesso à rede local (por omissão `0.0.0.0`) |
| `--no-live` | Não arranca o polling da API; a vista "Ao vivo" fica inerte |

Como o servidor escuta em `0.0.0.0`, o telemóvel na mesma rede pode abrir
`http://<ip-do-pc>:8000`.

Requer apenas **Python 3.9+**. Não é preciso `pip`, `npm` nem qualquer build.

---

## O que tem

Cinco vistas por escalão, com URL própria (`#/época/escalão/vista`):

- **Resumo** — próximo jogo, último resultado, forma, mini-classificação,
  melhores marcadores e os números da época.
- **Jogos** — todos os jogos agrupados por mês, com filtros (casa, fora,
  realizados, por jogar).
- **Detalhe de jogo** — marcador, parciais por período, liderança, comparação
  entre equipas, boxscore das duas equipas e play-by-play com marcador
  corrido.
- **Classificação** — tabela do grupo, com a linha do Farense destacada.
- **Plantel** — estatísticas agregadas por jogador, com ordenação por qualquer
  coluna.
- **Ao vivo** — marcador e últimas acções do jogo a decorrer, com actualização
  automática; fora de jogos, mostra os próximos encontros.

Duas épocas: **2025/2026** e **2026/2027**. Os escalões vão de Sub 10 a
Séniores, masculinos e femininos, incluindo equipas A/B e competições
distintas (campeonato, festival, taça).

---

## Actualizar os dados

```bash
python3 build_data.py
```

Lê a API, normaliza tudo e reescreve `data/farense.json`. As respostas cruas
ficam em `cache/`, por isso uma segunda execução sem alterações é quase
instantânea e não volta a bater na API.

Credenciais, por ordem de preferência:

1. Variáveis de ambiente `SWISH_EMAIL` / `SWISH_PASSWORD`
2. `creds.txt` ao lado dos scripts (duas linhas: email, password)
3. `~/.config/farense-basket/creds.txt`

O token de sessão é guardado em cache no directório de cache do utilizador
(`%LOCALAPPDATA%\farense-basket` no Windows, `~/.cache/farense-basket` no
Linux) e nunca dentro do projecto.

---

## Limites dos dados

Isto é importante: a plataforma **não** regista tudo o que um boxscore de
basquetebol costuma ter. O que existe e o que não existe:

| Dado | Estado |
|---|---|
| Pontos, parciais, resultado | completos |
| Lançamentos de 2 e 3 pontos **convertidos** | completos |
| Lançamentos de campo **falhados** | **não existem** na fonte |
| Lances livres (convertidos e falhados) | completos |
| Faltas cometidas e sofridas | completas |
| Valorização (FIBA) e +/− | completos |
| Minutos jogados | completos (em segundos) |
| Ressaltos, assistências, roubos, desarmes, perdas | sempre a zero |
| Posição/zona de lançamento | sempre a zero (sem mapas de tiro) |
| Play-by-play | só em jogos recentes com boxscore |

Consequência prática: **não há percentagem de lançamento de campo possível**.
As vistas mostram apenas os convertidos de 2 e 3 pontos, e marcam os lances
livres como `convertidos/tentados`. Esta limitação está escrita na própria
interface, junto dos números, para não induzir em erro.

---

## Estrutura

```
serve.py              servidor HTTP (stdlib): estático + gzip + /api/live + /api/meta
live.py               polling à API, estado em memória, thread de fundo
build_data.py         extractor e normalizador → data/farense.json
swish_client.py       cliente GraphQL/Firebase (login, token, cache de respostas)
data/farense.json     dataset da aplicação
cache/                respostas cruas da API (não versionado)
app/
  index.html          shell: sidebar, topbar mobile, contentor
  css/app.css         sistema de design completo (tokens, layout, componentes)
  js/
    app.js            routing por hash, shell, sidebar, selects mobile
    data.js           carregamento e derivações (agregados, totais, nomes)
    format.js         datas, horas, minutos, percentagens
    ui.js             componentes reutilizados (pill, cartão, barras)
    views/            resumo, jogos, jogo, classificacao, plantel, aovivo
scripts/check-views.mjs   teste de fumo das vistas contra o JSON real
```

---

## Verificação

```bash
# sintaxe de todo o JavaScript (usa o node do Windows, se estiver no WSL)
for f in app/js/*.js app/js/views/*.js; do node --check "$f"; done

# corre todas as vistas contra os dados reais
node scripts/check-views.mjs
```

O teste de fumo corre cada vista para cada equipa e cada jogo, e falha se
aparecer HTML vazio, `undefined`, `NaN` ou `[object Object]`.

Rotas do servidor: `/`, `/css/app.css`, `/js/…`, `/data/farense.json`,
`/api/meta` e `/api/live`.

---

## Notas técnicas

- **Sem build step.** Módulos ES nativos servidos tal como estão. O browser
  precisa de suporte a `import` (qualquer versão desde 2019).
- **Routing por hash.** Não precisa de reescrita de URLs no servidor e
  funciona a partir do sistema de ficheiros, se for preciso.
- **Datas.** A API devolve horas com sufixo `Z` que representam a hora local
  do pavilhão; a app lê os componentes do texto e nunca converte de fuso, para
  não deslocar os jogos uma hora.
- **Ao vivo por polling.** A API não tem subscrições, WebSockets nem SSE. O
  servidor consulta a API a cada 4 s quando há jogo a decorrer e a cada 25 s
  quando não há; o cliente lê `/api/live` a cada 5 s ou 20 s.
- **Sem cookies nem contas.** A app é só de leitura e não guarda nada sobre
  quem a visita.
