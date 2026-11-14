/**
 * Vigia — função agendada (a cada 5 min) que dispara a actualização dos dados
 * quando um jogo acaba.
 *
 * O cron do GitHub não cumpre os 20 min, por isso o gatilho passa para aqui:
 * a cada tick lê a agenda, compara o estado de cada jogo com o do tick anterior
 * (guardado em Netlify Blobs) e, quando um jogo passa a CLOSED, faz
 * workflow_dispatch de "Atualizar dados". Dispara ainda uma segunda vez
 * ATRASO_EXTRA depois, porque a mesa corrige resultados após o apito final.
 *
 * Variáveis de ambiente: SWISH_EMAIL / SWISH_PASSWORD (como o live.mjs),
 * GITHUB_DISPATCH_TOKEN (token restrito a este repositório, só Actions: write)
 * e, opcionalmente, GITHUB_REPO (por omissão DrNOFX97/basket-farense).
 */
import { getStore } from '@netlify/blobs';
import { carregarAgenda } from './live.mjs';

const JANELA_RECENTE = 6 * 3600 * 1000; // jogo acabado há menos disto conta como "acabou agora"
const ATRASO_EXTRA = 45 * 60 * 1000;
const DEBOUNCE = 4 * 60 * 1000; // no máximo um disparo por este intervalo

/**
 * Lógica pura. `prev` é o estado guardado, `jogos` a agenda actual
 * ([{ fid, estado, inicio }]), `agora` em ms. Devolve o que fazer e o novo estado.
 */
export function decidir(prev, jogos, agora) {
  const anterior = (prev && prev.estados) || {};
  // Parte do estado anterior: uma agenda incompleta não pode fazer esquecer jogos.
  const estados = { ...anterior };
  const extras = [...((prev && prev.extras) || [])];
  let disparar = !!(prev && prev.porDisparar);
  const motivos = [];

  for (const { fid, estado, inicio } of jogos) {
    estados[fid] = estado;
    const antes = anterior[fid];
    if (estado !== 'CLOSED' || antes === 'CLOSED') continue;
    const recente = Number.isFinite(inicio) && inicio <= agora && agora - inicio < JANELA_RECENTE;
    if (antes === 'LIVE' || recente) {
      disparar = true;
      extras.push(agora + ATRASO_EXTRA);
      motivos.push(`jogo ${fid} terminou`);
    }
  }

  const vencidos = extras.filter((t) => t <= agora);
  const restantes = extras.filter((t) => t > agora);
  if (vencidos.length) {
    disparar = true;
    motivos.push('verificação tardia');
  }

  const ultimoDisparo = (prev && prev.ultimoDisparo) || 0;
  const seguro = agora - ultimoDisparo >= DEBOUNCE;

  return {
    disparar: disparar && seguro,
    motivos,
    // Se ficou retido pelo debounce, mantém-se pendente para o tick seguinte.
    estado: { estados, extras: restantes, porDisparar: disparar && !seguro, ultimoDisparo },
  };
}

async function dispararWorkflow(token, repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/atualizar-dados.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'farense-basket-vigia',
    },
    body: JSON.stringify({ ref: 'main', inputs: { publicar: 'se-mudou' } }),
    signal: AbortSignal.timeout(10000),
  });
  if (r.status !== 204) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

export default async () => {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    console.log('vigia: falta GITHUB_DISPATCH_TOKEN, nada a fazer');
    return new Response('sem token', { status: 200 });
  }
  const repo = process.env.GITHUB_REPO || 'DrNOFX97/basket-farense';
  const loja = getStore('vigia');

  const mapa = await carregarAgenda(true);
  if (!mapa || !mapa.size) {
    // Agenda vazia = falha da plataforma, não "nenhum jogo": não mexe no estado.
    console.log('vigia: agenda vazia, a tentar no próximo tick');
    return new Response('agenda vazia', { status: 200 });
  }

  const jogos = [...mapa].map(([fid, { m }]) => ({
    fid,
    estado: (m.timeStatus || {}).status,
    inicio: Date.parse(m.date),
  }));
  const agora = Date.now();
  const prev = (await loja.get('estado', { type: 'json' }).catch(() => null)) || {};
  const r = decidir(prev, jogos, agora);

  if (r.disparar) {
    try {
      await dispararWorkflow(token, repo);
      r.estado.porDisparar = false;
      r.estado.ultimoDisparo = agora;
      console.log(`vigia: workflow disparado (${r.motivos.join(', ') || 'pendente'})`);
    } catch (e) {
      r.estado.porDisparar = true; // repete no próximo tick
      console.log(`vigia: falhou o disparo: ${e.message}`);
    }
  }

  await loja.setJSON('estado', r.estado);
  return new Response('ok', { status: 200 });
};

export const config = { schedule: '*/5 * * * *' };
