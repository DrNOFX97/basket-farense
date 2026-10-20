// Teste local da API com chave (sem Netlify): node scripts/check-api.mjs
// O armazém de chaves é substituído por um Map em memória com a mesma interface.
const A = 'a'.repeat(32);
process.env.API_KEYS = `${A}, curta`;

const { criarHandler } = await import('../netlify/functions/api.mjs');

const mem = new Map();
const store = {
  get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  setJSON: async (k, v) => { mem.set(k, JSON.stringify(v)); },
  delete: async (k) => { mem.delete(k); },
};
const handler = criarHandler(() => store);

const pede = (path, { headers = {}, method = 'GET', body } = {}) => handler({
  path, httpMethod: method, headers: { host: 'site.test', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const json = (r) => (r.body ? JSON.parse(r.body) : null);

let falhas = 0;
const espera = (nome, r, codigo, testa = () => true) => {
  const bom = r.statusCode === codigo && testa(json(r), r);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok  ' : 'FALHA'} ${nome} -> ${r.statusCode}`);
};

const F = { 'x-api-key': A };
const JSONCT = { 'content-type': 'application/json' };

// chaves fixas (API_KEYS)
espera('sem chave', await pede('/api/v1/all'), 401);
espera('chave errada', await pede('/api/v1/all', { headers: { 'x-api-key': A.slice(1) } }), 401);
espera('chave curta ignorada', await pede('/api/v1/all', { headers: { 'x-api-key': 'curta' } }), 401);
espera('chave fixa', await pede('/api/v1/all', { headers: F }), 200, (d) => d.epocas.length > 0);
espera('bearer', await pede('/api/v1/index', { headers: { authorization: `Bearer ${A}` } }), 200, (d) => d.epocas[0].equipas.length === 10);
espera('equipa', await pede('/api/v1/2026-2027/seniores-m', { headers: F }), 200, (d) => d.id === 'seniores-m');
const fid = json(await pede('/api/v1/2026-2027/seniores-m', { headers: F })).jogos[0].fid;
espera('jogo', await pede(`/api/v1/2026-2027/seniores-m/jogos/${fid}`, { headers: F }), 200, (d) => d.fid === fid);
espera('equipa inexistente', await pede('/api/v1/2026-2027/x', { headers: F }), 404);
espera('POST nos dados', await pede('/api/v1/all', { headers: F, method: 'POST' }), 405);
espera('preflight dados', await pede('/api/v1/all', { method: 'OPTIONS' }), 204);

// chaves criadas pelo site
const ip = { 'x-nf-client-connection-ip': '203.0.113.7' };
const criar = (nome, extra = {}) => pede('/api/keys', {
  method: 'POST', headers: { ...JSONCT, ...ip, ...extra }, body: { nome },
});

const c1 = await criar('App iOS');
espera('criar chave', c1, 201, (d) => d.chave.startsWith('fbk_') && d.id.length === 32 && d.nome === 'App iOS');
const k1 = json(c1);
espera('chave criada abre a API', await pede('/api/v1/index', { headers: { 'x-api-key': k1.chave } }), 200);
espera('chave criada adulterada', await pede('/api/v1/index', { headers: { 'x-api-key': `${k1.chave}x` } }), 401);
const guardado = [...mem.values()].join('');
if (guardado.includes(k1.chave)) { falhas++; console.log('FALHA a chave aparece em claro no armazém'); }
else console.log('ok   a chave não é guardada em claro');

espera('sem content-type json', await pede('/api/keys', { method: 'POST', headers: ip, body: {} }), 415);
espera('origem de outro site', await criar('x', { origin: 'https://mau.example' }), 403);
espera('origem do próprio site', await criar('mesmo', { origin: 'https://site.test' }), 201);
espera('GET em /api/keys', await pede('/api/keys'), 405);

espera('revogar com id inventado', await pede(`/api/keys/${'0'.repeat(32)}`, { method: 'DELETE' }), 404);
espera('revogar com lixo', await pede('/api/keys/../x', { method: 'DELETE' }), 404);
espera('revogar', await pede(`/api/keys/${k1.id}`, { method: 'DELETE' }), 204);
espera('chave revogada deixa de abrir', await pede('/api/v1/index', { headers: { 'x-api-key': k1.chave } }), 401);
espera('revogar duas vezes', await pede(`/api/keys/${k1.id}`, { method: 'DELETE' }), 404);

// limite por ligação: já há 1 activa ("mesmo"); criar até 5 e a 6ª falha
for (let i = 0; i < 4; i++) await criar(`n${i}`);
espera('limite por ligação', await criar('a mais'), 429);
const outroIp = await pede('/api/keys', { method: 'POST', headers: { ...JSONCT, 'x-nf-client-connection-ip': '198.51.100.9' }, body: {} });
espera('outra ligação não é afectada', outroIp, 201);

process.exit(falhas ? 1 : 0);
