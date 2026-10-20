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
- **Plantel** — estatísticas agregadas por jogador, com caras da API e ordenação
  por qualquer coluna.
- **Ao vivo** — marcador e últimas acções do jogo a decorrer, com actualização
  automática; fora de jogos, mostra os próximos encontros.

Época **2026/2027**. Os escalões vão de Sub 10 a
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

As fotos dos jogadores vêm de `Player.photo`. A primeira execução depois desta
alteração refaz o cache dos jogos (`match_foto_*`) para as trazer; quem não tiver
foto aparece com as iniciais na interface.

Credenciais, por ordem de preferência:

1. Variáveis de ambiente `SWISH_EMAIL` / `SWISH_PASSWORD`
2. `creds.txt` ao lado dos scripts (duas linhas: email, password)
3. `~/.config/farense-basket/creds.txt`

O token de sessão é guardado em cache no directório de cache do utilizador
(`%LOCALAPPDATA%\farense-basket` no Windows, `~/.cache/farense-basket` no
Linux) e nunca dentro do projecto.

### Fotos manuais

Sem credenciais Swish, as fotos podem ser adicionadas à mão nas pastas de cada
escalão dentro de `app/fotos/` (`seniores-m/`, `sub18-m-a/`, etc.). O nome do
ficheiro deve incluir o nome e o FID do jogador, por exemplo
`Gustavo Gonçalves 213344.jpg`. Também é aceite apenas o FID (`213344.jpg`) ou
apenas o nome completo, mas o nome + FID é o mais seguro. A lista
`app/fotos/jogadores.csv` tem os nomes, números, FIDs, pastas e nomes de
ficheiro sugeridos; depois de colocar as fotos, corre:

```bash
npm run fotos
```

O mapa gerado (`app/fotos/fotos.json`) é carregado pela app e tem prioridade
sobre as fotos da API. Formatos: JPG, PNG, WebP ou AVIF; idealmente quadradas,
400×400 px e menos de 500 KB. Para caras recortadas, usa PNG; se houver PNG e
JPEG do mesmo jogador, o script escolhe o PNG.

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
  img/emblema.png     emblema do clube (marca, favicon e og:image)
  css/app.css         sistema de design completo (tokens, layout, componentes)
  js/
    app.js            routing por hash, shell, sidebar, selects mobile
    data.js           carregamento e derivações (agregados, totais, nomes)
    format.js         datas, horas, minutos, percentagens
    ui.js             componentes reutilizados (pill, cartão, barras)
    views/            resumo, jogos, jogo, classificacao, plantel, aovivo
scripts/check-views.mjs   teste de fumo das vistas contra o JSON real
scripts/build-static.mjs  copia app/ + data/ para dist/ e gera a lista de equipas
scripts/check-live.mjs    testa a função ao vivo sem passar pelo Netlify
netlify.toml              build, redirect /api/live → função, cabeçalhos
netlify/
  functions/live.mjs      ao vivo no Netlify (equivalente do live.py)
  lib/equipas.mjs         gerado no build a partir de data/farense.json
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

```bash
# testa a função ao vivo à parte do Netlify (credenciais por argumento)
node scripts/check-live.mjs <email> <password>
```

---

## API para outras apps

API JSON só de leitura com chave, servida pela função `netlify/functions/api.mjs`.
Base: <https://basket-farense.netlify.app>. A chave vai no cabeçalho
`X-API-Key: <chave>` (ou `Authorization: Bearer <chave>`), nunca na URL.

| Endpoint | Conteúdo |
|---|---|
| `/api/v1/all` | tudo: épocas, equipas, classificação, plantel, jogos |
| `/api/v1/index` | épocas e equipas (sem jogos), com o `url` de cada uma |
| `/api/v1/<época>/<equipa>` | equipa completa |
| `/api/v1/<época>/<equipa>/jogos/<fid>` | um jogo (parciais, boxscore, acções) |

Sem chave ou com chave errada responde 401.

**Chaves.** No site, a página `#/api` (link "API" no menu lateral, desktop) deixa
cada pessoa gerar a sua chave. A chave aparece uma única vez; o servidor só
guarda o SHA-256 (Netlify Blobs, store `chaves`), por isso não há como a ver
outra vez. Para a revogar usa-se o `id`, que fica na lista do browser
(localStorage) de quem a criou. Limite de 5 chaves activas por ligação. A
gestão de chaves não funciona no `serve.py` local (não há Blobs).

Ao gerar uma chave, o botão "Copiar prompt com a chave" copia um prompt para
colar numa LLM (Claude Code, Cursor…) que esteja a construir outra app com estes
dados: traz a chave, os endpoints, a estrutura do JSON e as armadilhas (datas em
hora local, campos sempre a zero). O texto está em `promptLlm()` em
`app/js/views/api.js`; actualiza-o se o formato da API mudar.

Opcionalmente, a variável de ambiente `API_KEYS` do Netlify aceita chaves fixas
(mínimo 32 caracteres, separadas por vírgulas) para uso interno:

```bash
netlify env:set API_KEYS "$(openssl rand -hex 16)"
node scripts/check-api.mjs      # teste local, sem Netlify (armazém em memória)
```

Os dados mudam quando corres `python3 build_data.py` e voltas a publicar; o
campo `gerado` diz quando foi a última extracção. As datas vêm com `Z` mas são
hora local (não converter fusos).

---

## Publicação

- Repositório: <https://github.com/DrNOFX97/basket-farense>
- Site: <https://basket-farense.netlify.app>

O Netlify serve ficheiros estáticos: o build copia `app/` e
`data/farense.json` para `dist/` e publica essa pasta.

```bash
node scripts/build-static.mjs     # gera dist/ e netlify/lib/equipas.mjs
netlify deploy --prod --build     # build + deploy
```

O "Ao vivo" no site publicado é uma função Netlify
(`netlify/functions/live.mjs`), o equivalente do `live.py` para um ambiente sem
estado duradouro. Precisa de duas variáveis de ambiente no projecto Netlify:

| Variável | Valor |
| --- | --- |
| `SWISH_EMAIL` | conta descartável usada para autenticar na API |
| `SWISH_PASSWORD` | password dessa conta |

Sem elas, `/api/live` responde com um `erro` e a vista diz que o ao vivo não
está configurado; o resto do site funciona na mesma.

Para o site passar a actualizar sozinho a cada push, liga o repositório em
**Netlify → Site configuration → Build & deploy → Link repository**. O
comando de build e a pasta a publicar já vêm do `netlify.toml`.

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
