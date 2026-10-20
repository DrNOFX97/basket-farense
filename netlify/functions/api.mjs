/**
 * API de leitura com chave, para apps externas.
 *
 * Dados (precisam de chave):
 *   GET /api/v1/all                              tudo (épocas, equipas, jogos)
 *   GET /api/v1/index                            épocas e equipas, sem jogos
 *   GET /api/v1/<época>/<equipa>                 equipa completa
 *   GET /api/v1/<época>/<equipa>/jogos/<fid>     um jogo (boxscore e acções)
 *
 * Chaves (usadas pela página #/api do site):
 *   POST   /api/keys        {nome?}  cria uma chave; a chave só vem nesta resposta
 *   DELETE /api/keys/<id>            revoga a chave com esse id
 *
 * A chave vai no cabeçalho `X-API-Key` (ou `Authorization: Bearer <chave>`),
 * nunca na URL, para não ficar em logs. Aceitam-se dois tipos:
 *   - chaves criadas na página: só se guarda o SHA-256 (Netlify Blobs), por isso
 *     nem nós conseguimos voltar a ver uma chave;
 *   - chaves fixas na variável de ambiente API_KEYS, separadas por vírgulas
 *     (mínimo 32 caracteres), para uso interno.
 *
 * Blobs (store "chaves"):
 *   h/<sha256 da chave>  -> {id, nome, criada, ip}   consulta ao autenticar
 *   i/<id>               -> {h, ip}                   consulta ao revogar
 *   ip/<sha256 do ip>    -> [id, ...]                 limite por ligação
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';
import dados from '../../data/farense.json' with { type: 'json' };

const PREFIXO = 'fbk_';
const CHAVE_MIN = 32; // `openssl rand -hex 16` dá 32 caracteres
const MAX_CHAVES_POR_IP = 5;
const MAX_NOME = 40;

const CORS_DADOS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-API-Key, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const resposta = (statusCode, corpo, extra = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  body: corpo === null ? '' : JSON.stringify(corpo),
});

// Compara resumos SHA-256 (largura fixa), por isso o tempo não depende do
// comprimento da chave recebida.
const resumo = (t) => createHash('sha256').update(String(t)).digest();
const hex = (t) => resumo(t).toString('hex');
const igual = (a, b) => timingSafeEqual(resumo(a), resumo(b));

function chavesFixas() {
  return (process.env.API_KEYS || '').split(',').map((k) => k.trim()).filter((k) => k.length >= CHAVE_MIN);
}

async function autorizado(headers, store) {
  const bearer = /^Bearer\s+(.+)$/i.exec(headers.authorization || '');
  const chave = headers['x-api-key'] || (bearer && bearer[1]) || '';
  if (!chave) return false;

  // Percorre todas para o tempo não revelar qual chave coincidiu.
  if (chavesFixas().reduce((ok, k) => igual(chave, k) || ok, false)) return true;

  if (!chave.startsWith(PREFIXO)) return false;
  try {
    return !!(await store.get(`h/${hex(chave)}`, { type: 'json' }));
  } catch (e) {
    console.error('api: falha a ler o armazém de chaves', e);
    return false;
  }
}

function indice() {
  return {
    versao: 1,
    gerado: dados.gerado,
    fonte: dados.fonte,
    epocas: dados.epocas.map((e) => ({
      id: e.id,
      nome: e.nome,
      equipas: e.equipas.map((t) => ({
        id: t.id, nome: t.nome, nomeCurto: t.nomeCurto, escalao: t.escalao,
        genero: t.genero, competicao: t.competicao, logo: t.logo, jogos: t.jogos.length,
        url: `/api/v1/${e.id}/${t.id}`,
      })),
    })),
  };
}

// ------------------------------------------------------------------ dados --
async function servirDados(event, store) {
  const cors = { ...CORS_DADOS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return resposta(405, { erro: 'método não permitido' }, { ...cors, Allow: 'GET, OPTIONS' });

  if (!(await autorizado(event.headers, store))) {
    return resposta(401, { erro: 'chave de API em falta ou inválida' }, { ...cors, 'WWW-Authenticate': 'Bearer' });
  }

  const partes = (event.path || '')
    .replace(/^.*?\/api\/v1\/?/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);

  const ok = (corpo) => resposta(200, corpo, { ...cors, 'Cache-Control': 'private, max-age=300' });
  const naoExiste = () => resposta(404, { erro: 'não encontrado' }, cors);

  if (partes.length === 0 || (partes.length === 1 && partes[0] === 'index')) return ok(indice());
  if (partes.length === 1 && partes[0] === 'all') return ok({ versao: 1, ...dados });

  const [epocaId, equipaId, sub, jogoFid] = partes;
  const equipa = dados.epocas.find((e) => e.id === epocaId)?.equipas.find((t) => t.id === equipaId);
  if (!equipa) return naoExiste();

  if (partes.length === 2) return ok({ versao: 1, gerado: dados.gerado, ...equipa });
  if (partes.length === 4 && sub === 'jogos') {
    const jogo = equipa.jogos.find((j) => j.fid === jogoFid);
    return jogo ? ok({ versao: 1, gerado: dados.gerado, ...jogo }) : naoExiste();
  }
  return naoExiste();
}

// ----------------------------------------------------------------- chaves --
// Sem CORS: só o próprio site cria e revoga chaves. Um pedido de outra origem
// falha no preflight, e os que chegam com `Origin` diferente são recusados.
function origemPermitida(headers) {
  if (!headers.origin) return true; // curl e afins não enviam Origin
  try {
    return new URL(headers.origin).host === headers.host;
  } catch {
    return false;
  }
}

async function criarChave(event, store) {
  if (!/^application\/json/i.test(event.headers['content-type'] || '')) {
    return resposta(415, { erro: 'Content-Type deve ser application/json' });
  }
  let corpo = {};
  try {
    corpo = event.body ? JSON.parse(event.body) : {};
  } catch {
    return resposta(400, { erro: 'JSON inválido' });
  }
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim().slice(0, MAX_NOME) : '';

  const ip = hex(event.headers['x-nf-client-connection-ip'] || 'desconhecido');
  const lista = (await store.get(`ip/${ip}`, { type: 'json' })) || [];
  if (lista.length >= MAX_CHAVES_POR_IP) {
    return resposta(429, { erro: `limite de ${MAX_CHAVES_POR_IP} chaves activas; revoga uma antes de criar outra` });
  }

  const chave = PREFIXO + randomBytes(32).toString('base64url');
  const id = randomBytes(16).toString('hex');
  const h = hex(chave);
  const criada = new Date().toISOString();

  await store.setJSON(`h/${h}`, { id, nome, criada, ip });
  await store.setJSON(`i/${id}`, { h, ip });
  await store.setJSON(`ip/${ip}`, [...lista, id]);

  return resposta(201, { chave, id, nome, criada }, { 'Cache-Control': 'no-store' });
}

// O id (128 bits aleatórios) só o conhece quem criou a chave: é ele que autoriza
// a revogação, porque a chave em si já não é visível.
async function revogarChave(id, store) {
  if (!/^[0-9a-f]{32}$/.test(id)) return resposta(404, { erro: 'chave não encontrada' });
  const reg = await store.get(`i/${id}`, { type: 'json' });
  if (!reg) return resposta(404, { erro: 'chave não encontrada' });

  await store.delete(`h/${reg.h}`);
  await store.delete(`i/${id}`);
  const lista = (await store.get(`ip/${reg.ip}`, { type: 'json' })) || [];
  await store.setJSON(`ip/${reg.ip}`, lista.filter((x) => x !== id));

  return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
}

async function gerirChaves(event, store) {
  if (!origemPermitida(event.headers)) return resposta(403, { erro: 'origem não permitida' });

  const id = (event.path || '').replace(/^.*?\/api\/keys\/?/, '').replace(/\/+$/, '');
  if (!id && event.httpMethod === 'POST') return criarChave(event, store);
  if (id && event.httpMethod === 'DELETE') return revogarChave(id, store);
  return resposta(405, { erro: 'método não permitido' }, { Allow: id ? 'DELETE' : 'POST' });
}

// ---------------------------------------------------------------- entrada --
export function criarHandler(abrirStore) {
  return async (event) => {
    event.headers = event.headers || {};
    try {
      const store = abrirStore(event);
      return /\/api\/keys(\/|$)/.test(event.path || '')
        ? await gerirChaves(event, store)
        : await servirDados(event, store);
    } catch (e) {
      console.error('api: erro', e);
      return resposta(500, { erro: 'erro interno' });
    }
  };
}

export const handler = criarHandler((event) => {
  connectLambda(event);
  return getStore('chaves');
});
