// Teste local da API com chave (sem Netlify): node scripts/check-api.mjs
const A = 'a'.repeat(32);
const B = 'b'.repeat(32);
process.env.API_KEYS = `${A}, ${B}, curta`;
const { handler } = await import('../netlify/functions/api.mjs');

const pede = (path, headers = {}, httpMethod = 'GET') => handler({ path, httpMethod, headers });
let falhas = 0;
const espera = (nome, r, codigo, testa = () => true) => {
  const bom = r.statusCode === codigo && testa(r.body ? JSON.parse(r.body) : null);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok  ' : 'FALHA'} ${nome} -> ${r.statusCode}`);
};

const K = { 'x-api-key': B };
espera('sem chave', await pede('/api/v1/all'), 401);
espera('chave errada', await pede('/api/v1/all', { 'x-api-key': B.slice(1) }), 401);
espera('chave certa (2ª)', await pede('/api/v1/all', K), 200, (d) => d.epocas.length > 0);
espera('bearer', await pede('/api/v1/index', { authorization: `Bearer ${A}` }), 200, (d) => d.epocas[0].equipas.length === 10);
espera('equipa', await pede('/api/v1/2026-2027/seniores-m', K), 200, (d) => d.id === 'seniores-m' && d.jogos.length > 0);
const fid = JSON.parse((await pede('/api/v1/2026-2027/seniores-m', K)).body).jogos[0].fid;
espera('jogo', await pede(`/api/v1/2026-2027/seniores-m/jogos/${fid}`, K), 200, (d) => d.fid === fid);
espera('equipa inexistente', await pede('/api/v1/2026-2027/x', K), 404);
espera('POST', await pede('/api/v1/all', K, 'POST'), 405);
espera('preflight sem chave', await pede('/api/v1/all', {}, 'OPTIONS'), 204);
espera('chave curta ignorada', await pede('/api/v1/all', { 'x-api-key': 'curta' }), 401);
delete process.env.API_KEYS;
espera('sem API_KEYS recusa', await pede('/api/v1/all', K), 503);
process.exit(falhas ? 1 : 0);
