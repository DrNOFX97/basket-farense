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
console.log(`  atualizado=${d.atualizado} jogos=${d.jogos.length} proximos=${d.proximos.length} erro=${d.erro}`);

const p = d.proximos[0];
if (p) {
  console.log('  exemplo:', JSON.stringify({
    fid: p.fid, inicio: p.inicio, casa: p.casa, fora: p.fora,
    casaFid: p.casaFid, foraFid: p.foraFid, equipa: p.equipa.nome,
    pontos: p.pontos, status: p.status,
  }));
}
console.log('  escalões distintos nos próximos:', new Set(d.proximos.map((x) => x.equipa.teamFid)).size);

const t2 = Date.now();
await handler({});
console.log(`2a chamada (cache): ${Date.now() - t2} ms`);
