/**
 * /api/v1/* — API de leitura com chave, para apps externas.
 *
 * A chave vai no cabeçalho `X-API-Key` (ou `Authorization: Bearer <chave>`),
 * nunca na URL, para não ficar em logs. As chaves válidas vêm da variável de
 * ambiente API_KEYS, separadas por vírgulas; uma por cliente permite revogar
 * uma sem afectar as outras. Sem API_KEYS configurada a API recusa tudo.
 *
 *   GET /api/v1/all                              tudo (épocas, equipas, jogos)
 *   GET /api/v1/index                            épocas e equipas, sem jogos
 *   GET /api/v1/<época>/<equipa>                 equipa completa
 *   GET /api/v1/<época>/<equipa>/jogos/<fid>     um jogo (boxscore e acções)
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import dados from '../../data/farense.json' with { type: 'json' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-API-Key, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const resposta = (statusCode, corpo, extra = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  body: JSON.stringify(corpo),
});

// Chaves curtas são ignoradas: `openssl rand -hex 16` dá 32 caracteres.
const CHAVE_MIN = 32;

function chavesValidas() {
  return (process.env.API_KEYS || '').split(',').map((k) => k.trim()).filter((k) => k.length >= CHAVE_MIN);
}

// Compara resumos SHA-256 (largura fixa), por isso o tempo não depende do
// comprimento da chave recebida.
const resumo = (t) => createHash('sha256').update(String(t)).digest();
const igual = (a, b) => timingSafeEqual(resumo(a), resumo(b));

function autorizado(headers) {
  const bearer = /^Bearer\s+(.+)$/i.exec(headers.authorization || '');
  const chave = headers['x-api-key'] || (bearer && bearer[1]) || '';
  // Percorre todas para o tempo não revelar qual chave coincidiu.
  return chavesValidas().reduce((ok, k) => igual(chave, k) || ok, false);
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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return resposta(405, { erro: 'método não permitido' }, { Allow: 'GET, OPTIONS' });

  if (!chavesValidas().length) return resposta(503, { erro: 'API não configurada' });
  if (!autorizado(event.headers || {})) {
    return resposta(401, { erro: 'chave de API em falta ou inválida' }, { 'WWW-Authenticate': 'Bearer' });
  }

  const partes = (event.path || '')
    .replace(/^.*?\/api\/v1\/?/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);

  const cache = { 'Cache-Control': 'private, max-age=300' };
  const ok = (corpo) => resposta(200, corpo, cache);
  const naoExiste = () => resposta(404, { erro: 'não encontrado' });

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
};
