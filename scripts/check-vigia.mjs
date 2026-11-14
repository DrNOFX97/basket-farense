// Teste da lógica do vigia (netlify/functions/vigia.mjs): node scripts/check-vigia.mjs
import { decidir } from '../netlify/functions/vigia.mjs';

let falhas = 0;
const ok = (c, msg) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${msg}`); if (!c) falhas++; };
const H = 3600e3, M = 60e3;
const t0 = Date.parse('2026-11-14T18:00:00Z');
const jogo = (estado, inicio = t0 - 2 * H) => [{ fid: '1', estado, inicio }];

// 1. LIVE → CLOSED dispara e agenda a verificação tardia.
let r = decidir({ estados: { 1: 'LIVE' } }, jogo('CLOSED'), t0);
ok(r.disparar, 'LIVE → CLOSED dispara');
ok(r.estado.extras.length === 1 && r.estado.extras[0] === t0 + 45 * M, 'agenda verificação 45 min depois');

// 2. Já estava CLOSED: nada.
r = decidir({ estados: { 1: 'CLOSED' } }, jogo('CLOSED'), t0);
ok(!r.disparar, 'CLOSED → CLOSED não dispara');

// 3. Jogo sem estado anterior, CLOSED, recente: dispara (acabou entre dois ticks).
r = decidir({}, jogo('CLOSED'), t0);
ok(r.disparar, 'primeiro tick com jogo recém-fechado dispara');

// 4. Jogo antigo sem estado anterior: não dispara (arranque a frio).
r = decidir({}, jogo('CLOSED', t0 - 3 * 24 * H), t0);
ok(!r.disparar, 'jogo antigo no arranque não dispara');

// 5. Verificação tardia vencida dispara e sai da lista.
r = decidir({ estados: { 1: 'CLOSED' }, extras: [t0 - M], ultimoDisparo: t0 - 50 * M }, jogo('CLOSED'), t0);
ok(r.disparar && r.estado.extras.length === 0, 'verificação tardia vencida dispara');

// 6. Debounce: retido, fica pendente para o tick seguinte.
r = decidir({ estados: { 1: 'LIVE' }, ultimoDisparo: t0 - 1 * M }, jogo('CLOSED'), t0);
ok(!r.disparar && r.estado.porDisparar, 'debounce retém e deixa pendente');
r = decidir(r.estado, jogo('CLOSED'), t0 + 5 * M);
ok(r.disparar, 'pendente dispara quando o debounce acaba');

// 7. Falha de disparo (porDisparar mantido) repete.
r = decidir({ estados: { 1: 'CLOSED' }, porDisparar: true }, jogo('CLOSED'), t0);
ok(r.disparar, 'disparo falhado é repetido');

// 8. Agenda incompleta não faz esquecer jogos nem re-disparar.
r = decidir({ estados: { 1: 'CLOSED' } }, [], t0);
ok(r.estado.estados[1] === 'CLOSED' && !r.disparar, 'agenda incompleta conserva o estado');

// 9. NOT_STARTED → LIVE não dispara.
r = decidir({ estados: { 1: 'NOT_STARTED' } }, jogo('LIVE'), t0);
ok(!r.disparar, 'início de jogo não dispara');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo ok');
process.exit(falhas ? 1 : 0);
