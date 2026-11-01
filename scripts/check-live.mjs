// Teste local da função Netlify.
//
//   node scripts/check-live.mjs <email> <password>
//
// Recebe as credenciais por argumento porque o WSL não passa variáveis de
// ambiente para processos Windows. No Netlify vêm do ambiente.
if (process.argv[2]) process.env.SWISH_EMAIL = process.argv[2];
if (process.argv[3]) process.env.SWISH_PASSWORD = process.argv[3];

const { handler } = await import('../netlify/functions/live.mjs');

console.log('credenciais no processo:', !!process.env.SWISH_EMAIL, !!process.env.SWISH_PASSWORD);

const t0 = Date.now();
const r = await handler({});
const t1 = Date.now();
const d = JSON.parse(r.body);

console.log(`1a chamada: ${r.statusCode} em ${t1 - t0} ms`);
console.log(`  atualizado=${d.atualizado} jogos=${d.jogos.length} erro=${d.erro}`);
if ('proximos' in d) throw new Error('a resposta já não deve ter "proximos"');

const j = d.jogos[0];
if (j) {
  console.log('  exemplo:', JSON.stringify({
    fid: j.fid, casa: j.casa, fora: j.fora, equipa: j.equipa.nome,
    pontos: j.pontos, periodo: j.periodo, status: j.status,
  }));
}

const t2 = Date.now();
await handler({});
console.log(`2a chamada (cache): ${Date.now() - t2} ms`);
