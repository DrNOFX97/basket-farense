/**
 * /api/live — estado ao vivo do Farense na plataforma NBN23.
 *
 * A API não tem WebSocket nem subscrições: cada acção da mesa é escrita no
 * backend durante o jogo, por isso polling dá o mesmo resultado com 3 a 5 s de
 * atraso.
 *
 * Esta função é o equivalente do `live.py` local, adaptada a um ambiente sem
 * estado duradouro:
 *   - a agenda fica em cache 5 minutos por instância;
 *   - só os jogos a decorrer são pedidos em detalhe;
 *   - os próximos jogos vêm da agenda, sem um pedido por jogo;
 *   - o resultado completo fica em cache 4 s (com jogo) ou 25 s (sem jogo).
 *
 * As credenciais vêm das variáveis de ambiente SWISH_EMAIL e SWISH_PASSWORD.
 */
import EQUIPAS from '../lib/equipas.mjs';

const FIREBASE_KEY = 'AIzaSyDfES1qET23MQ0Y5_cgbDYbeQ168xVcpiA';
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`;
const GRAPHQL = 'https://internal.nbn23.app/graphql';
const PKG = 'com.nbn23.fansapp';
const VER = '2.10.0';

const TTL_VIVO = 4000;
const TTL_IDLE = 25000;
const TTL_AGENDA = 5 * 60 * 1000;
const TTL_AGENDA_JOGO = 30 * 1000;
// Janela em que um jogo pode estar a decorrer (as horas da API são locais, ver CLAUDE.md).
const JANELA_ANTES = 30 * 60 * 1000;
const JANELA_DEPOIS = 4 * 3600 * 1000;
const PRAZO = 12000;
const TIMEOUT = 8000;

const Q_SCHED = `query S($projectKey: String!, $competitionFid: String!, $teamFid: String!) {
  teamMatch(projectKey: $projectKey, competitionFid: $competitionFid, teamFid: $teamFid) {
    fid date timeStatus { status period time }
    homeTeam { id name } awayTeam { id name }
    scores { total { homeScore awayScore } }
  } }`;

const Q_MATCH = `query L($projectKey: String!, $fid: String!) {
  matchBy(projectKey: $projectKey, fid: $fid) {
    fid status date roundName
    homeTeam { fid name } awayTeam { fid name }
    scores { total { homeScore awayScore }
             partials { period homeScore awayScore } }
    timeStatus { status period time }
    stats { biggestLead { homeTeam awayTeam } timesTied leadChanges }
    boxscore {
      homeTeam { players { player { fid name lastName number } stats {
        timePlayed points inArcThrowsMade outArcThrowsMade freeThrowsMade
        freeThrowsFailed fouls fibaRating plusMinus } } }
      awayTeam { players { player { fid name lastName number } stats {
        timePlayed points inArcThrowsMade outArcThrowsMade freeThrowsMade
        freeThrowsFailed fouls fibaRating plusMinus } } } }
    actions { period time actor { fid type } code subCode value result teamFid }
  } }`;

let token = { valor: null, exp: 0 };
let agenda = { mapa: null, em: 0 };
let instantaneo = null;
let instantaneoEm = 0;
let emCurso = null;

// ------------------------------------------------------------------ formato --
const relogio = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

const agoraTexto = () => relogio.format(new Date());

// -------------------------------------------------------------------- auth --
async function idToken() {
  if (token.valor && Date.now() < token.exp) return token.valor;

  const email = process.env.SWISH_EMAIL;
  const password = process.env.SWISH_PASSWORD;

  if (!email || !password) {
    throw new Error('ao vivo não configurado: faltam SWISH_EMAIL e SWISH_PASSWORD');
  }

  const r = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const d = await r.json().catch(() => ({}));

  if (!r.ok || !d.idToken) {
    const motivo = (d.error && d.error.message) || `HTTP ${r.status}`;
    throw new Error(`autenticação recusada: ${motivo}`);
  }

  const segundos = Math.max(60, (parseInt(d.expiresIn, 10) || 3600) - 120);
  token = { valor: d.idToken, exp: Date.now() + segundos * 1000 };
  return token.valor;
}

async function gql(query, variables, tentativa = 0) {
  const tk = await idToken();

  const r = await fetch(GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tk}`,
      'x-package-name': PKG,
      'x-package-version': VER,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (r.status === 401 && tentativa === 0) {
    token = { valor: null, exp: 0 };
    return gql(query, variables, 1);
  }

  if (!r.ok) {
    const texto = await r.text().catch(() => '');
    throw new Error(`GraphQL ${r.status}: ${texto.slice(0, 120)}`);
  }

  return r.json();
}

// ------------------------------------------------------------------- agenda --
// Há jogo que começa já ou que devia estar a decorrer? Então a agenda refresca
// depressa para apanhar a mudança para LIVE.
function emJanela(m, agora) {
  const quando = Date.parse(m && m.date);
  const ts = (m && m.timeStatus) || {};
  return !Number.isNaN(quando) && ts.status !== 'FINISHED'
    && quando - agora < JANELA_ANTES && agora - quando < JANELA_DEPOIS;
}

function haJogoNaJanela() {
  if (!agenda.mapa) return false;
  const agora = Date.now();
  for (const { m } of agenda.mapa.values()) if (emJanela(m, agora)) return true;
  return false;
}

async function carregarAgenda() {
  if (agenda.mapa && Date.now() - agenda.em < (haJogoNaJanela() ? TTL_AGENDA_JOGO : TTL_AGENDA)) {
    return agenda.mapa;
  }

  const inicio = Date.now();
  const mapa = new Map();

  // Em lotes de 4 para não abrir 16 ligações ao mesmo tempo.
  for (let i = 0; i < EQUIPAS.length; i += 4) {
    if (Date.now() - inicio > PRAZO) break;

    const lote = EQUIPAS.slice(i, i + 4);
    const respostas = await Promise.all(lote.map(async (t) => {
      try {
        const d = await gql(Q_SCHED, {
          projectKey: t.projectKey,
          competitionFid: t.compFid,
          teamFid: t.teamFid,
        });
        return { t, jogos: (d && d.data && d.data.teamMatch) || [] };
      } catch {
        return { t, jogos: [] };
      }
    }));

    for (const { t, jogos } of respostas) {
      for (const m of jogos) {
        if (m && m.fid) mapa.set(String(m.fid), { m, equipa: t });
      }
    }
  }

  if (mapa.size) agenda = { mapa, em: Date.now() };
  return agenda.mapa || mapa;
}

function campoEquipa(t) {
  return {
    id: t.id,
    nome: t.nome,
    teamFid: t.teamFid,
    compFid: t.compFid,
    competicao: t.competicao,
    epoca: t.epoca,
  };
}

// --------------------------------------------------------------- jogo atual --
async function jogoDetalhado(fid) {
  const entrada = agenda.mapa && agenda.mapa.get(String(fid));
  if (!entrada) return null;

  const t = entrada.equipa;
  const d = await gql(Q_MATCH, { projectKey: t.projectKey, fid: fid });
  const m = ((d && d.data && d.data.matchBy) || [])[0];
  if (!m) return null;

  const ts = m.timeStatus || {};
  const total = (m.scores && m.scores.total) || {};
  const stats = m.stats || {};

  const out = {
    fid: String(fid),
    status: m.status,
    inicio: m.date,
    jornada: m.roundName,
    periodo: ts.period,
    relogio: ts.time,
    casa: (m.homeTeam || {}).name,
    fora: (m.awayTeam || {}).name,
    casaFid: (m.homeTeam || {}).fid,
    foraFid: (m.awayTeam || {}).fid,
    pontos: [total.homeScore ?? 0, total.awayScore ?? 0],
    parciais: ((m.scores && m.scores.partials) || []).map((q) => [q.period, q.homeScore, q.awayScore]),
    lideranca: stats.biggestLead
      ? {
        maiorCasa: (stats.biggestLead || {}).homeTeam,
        maiorFora: (stats.biggestLead || {}).awayTeam,
        empates: stats.timesTied,
        trocas: stats.leadChanges,
      }
      : null,
    jogadores: { casa: [], fora: [] },
    accoes: [],
    equipa: campoEquipa(t),
  };

  for (const [lado, chave] of [['casa', 'homeTeam'], ['fora', 'awayTeam']]) {
    const bloco = (m.boxscore && m.boxscore[chave]) || {};
    for (const r of bloco.players || []) {
      if (!r || !r.stats) continue;
      const p = r.player || {};
      const s = r.stats;
      out.jogadores[lado].push({
        fid: p.fid,
        num: p.number,
        nome: `${p.name || ''} ${p.lastName || ''}`.trim(),
        min: s.timePlayed,
        pts: s.points,
        c2: s.inArcThrowsMade,
        c3: s.outArcThrowsMade,
        cll: s.freeThrowsMade,
        fll: s.freeThrowsFailed,
        ft: s.fouls,
        val: s.fibaRating,
        pm: s.plusMinus,
      });
    }
  }

  const accoes = (m.actions || []).slice().sort((a, b) => (a.period || 0) - (b.period || 0) || (a.time || 0) - (b.time || 0));
  for (const a of accoes) {
    out.accoes.push([
      a.period, a.time,
      (a.actor || {}).fid, (a.actor || {}).type,
      a.code, a.subCode, a.value, a.result, a.teamFid,
    ]);
  }

  return out;
}

// Próximo jogo montado a partir da agenda: sem pedido extra por jogo.
function jogoResumido(fid) {
  const entrada = agenda.mapa && agenda.mapa.get(String(fid));
  if (!entrada) return null;

  const { m, equipa } = entrada;
  const ts = m.timeStatus || {};
  const total = (m.scores && m.scores.total) || {};

  return {
    fid: String(fid),
    status: m.status || ts.status,
    inicio: m.date,
    jornada: null,
    periodo: ts.period,
    relogio: ts.time,
    casa: (m.homeTeam || {}).name,
    fora: (m.awayTeam || {}).name,
    casaFid: (m.homeTeam || {}).id,
    foraFid: (m.awayTeam || {}).id,
    pontos: [total.homeScore ?? 0, total.awayScore ?? 0],
    parciais: [],
    lideranca: null,
    jogadores: { casa: [], fora: [] },
    accoes: [],
    equipa: campoEquipa(equipa),
  };
}

// ------------------------------------------------------------------ refresh --
async function atualizar() {
  let erro = null;
  const jogos = [];
  const proximos = [];

  try {
    const mapa = await carregarAgenda();
    if (!mapa.size) throw new Error('agenda vazia');

    const agora = Date.now();
    const vivos = [];
    const futuros = [];

    for (const [fid, entrada] of mapa) {
      const ts = (entrada.m && entrada.m.timeStatus) || {};
      // LIVE na agenda, ou jogo dentro da janela horária: a agenda pode estar
      // atrasada, o detalhe diz a verdade.
      if (ts.status === 'LIVE' || emJanela(entrada.m, agora)) {
        vivos.push(fid);
        continue;
      }
      if (ts.status === 'NOT_STARTED' && entrada.m && entrada.m.date) {
        const quando = Date.parse(entrada.m.date);
        if (!Number.isNaN(quando) && quando > agora - 2 * 3600 * 1000) {
          futuros.push([quando, fid]);
        }
      }
    }

    futuros.sort((a, b) => a[0] - b[0]);

    for (const fid of vivos) {
      try {
        const j = await jogoDetalhado(fid);
        if (j && (j.status === 'LIVE' || j.estadoRelogio === 'LIVE')) jogos.push(j);
      } catch (e) {
        erro = `jogo ${fid}: ${e.message}`;
      }
    }

    for (const [, fid] of futuros.slice(0, 24)) {
      const j = jogoResumido(fid);
      if (j) proximos.push(j);
    }
  } catch (e) {
    erro = e.message || String(e);
  }

  instantaneo = {
    atualizado: agoraTexto(),
    jogos,
    proximos,
    erro,
  };
  instantaneoEm = Date.now();

  return instantaneo;
}

function resposta(corpo) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(corpo),
  };
}

export const handler = async () => {
  try {
    const ttl = instantaneo && instantaneo.jogos.length ? TTL_VIVO : TTL_IDLE;

    if (instantaneo && Date.now() - instantaneoEm < ttl) {
      return resposta(instantaneo);
    }

    if (emCurso) {
      await emCurso.catch(() => {});
      return resposta(instantaneo || { atualizado: null, jogos: [], proximos: [], erro: null });
    }

    emCurso = atualizar();
    try {
      await emCurso;
    } finally {
      emCurso = null;
    }

    return resposta(instantaneo);
  } catch (e) {
    return resposta({
      atualizado: instantaneo ? instantaneo.atualizado : null,
      jogos: instantaneo ? instantaneo.jogos : [],
      proximos: instantaneo ? instantaneo.proximos : [],
      erro: e.message || String(e),
    });
  }
};
