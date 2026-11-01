// Teste de fumo: corre todas as vistas contra o JSON real e verifica que
// produzem HTML plausível. Não substitui o browser, mas apanha excepções,
// campos em falta e textos "undefined".
//
//   node scripts/check-views.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const view = (f) => import(pathToFileURL(path.join(RAIZ, 'app/js/views', f)).href);

const { default: resumo } = await view('resumo.js');
const { default: jogos } = await view('jogos.js');
const { default: jogo } = await view('jogo.js');
const { default: classificacao } = await view('classificacao.js');
const { default: plantel } = await view('plantel.js');
const { default: aovivo } = await view('aovivo.js');
const { default: api } = await view('api.js');

const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/farense.json'), 'utf8'));

// A vista da API lê localStorage; fora do browser não existe e a vista tem de aguentar.
let falhas = 0;
let testes = 0;

function verificar(nome, html) {
  testes += 1;
  const problemas = [];
  if (typeof html !== 'string' || !html.trim()) problemas.push('HTML vazio');
  if (/undefined/.test(html)) problemas.push('contém "undefined"');
  if (/NaN/.test(html)) problemas.push('contém "NaN"');
  if (/\[object Object\]/.test(html)) problemas.push('contém [object Object]');
  if (problemas.length) {
    falhas += 1;
    console.error(`  FALHA ${nome}: ${problemas.join(', ')}`);
    const i = html.indexOf('undefined') >= 0 ? html.indexOf('undefined')
      : html.indexOf('NaN') >= 0 ? html.indexOf('NaN') : html.indexOf('[object Object]');
    if (i >= 0) console.error(`        …${html.slice(Math.max(0, i - 90), i + 60).replace(/\s+/g, ' ')}…`);
  } else {
    console.log(`  ok    ${nome} (${html.length} B)`);
  }
}

for (const ep of dados.epocas) {
  for (const t of ep.equipas) {
    const ctx = { epoca: ep.id, equipa: t.id, vista: 'resumo', param: null };
    const marca = `${ep.id}/${t.id}`;

    verificar(`${marca} resumo`, resumo.render(t, ctx));
    verificar(`${marca} jogos`, jogos.render(t, ctx));
    verificar(`${marca} classificacao`, classificacao.render(t, ctx));
    verificar(`${marca} plantel`, plantel.render(t, ctx));
    verificar(`${marca} ao-vivo`, aovivo.render(t, ctx));

    const comDetalhe = t.jogos.filter((j) => j.jogado);
    for (const j of comDetalhe) {
      const c = { ...ctx, vista: 'jogo', param: j.fid };
      verificar(`${marca} jogo ${j.fid}`, jogo.render(t, c));
    }
  }
}

// Ao vivo: não há jogo a decorrer em teste, por isso simula-se um a partir de
// cada jogo real, cortado a meio do 3.º período.
const { desenhar: desenharLive } = await view('aovivo.js');
const G = await import(pathToFileURL(path.join(RAIZ, 'app/js/charts.js')).href);

function simularLive(t, j) {
  const corte = (a) => a[0] < 3 || (a[0] === 3 && a[1] >= 300000);
  const accoes = (j.accoes || []).filter(corte);
  const soma = (lado) => accoes.filter((a) => a[4] === 'POINTS' && a[7]
    && String(a[8]) === String(lado)).reduce((s, a) => s + (a[6] || 0), 0);
  return {
    ...j,
    status: 'LIVE', periodo: 3, relogio: 300000,
    accoes,
    parciais: (j.parciais || []).filter(([p]) => p <= 3),
    pontos: [soma(j.casaFid), soma(j.foraFid)],
    equipa: { teamFid: t.teamFid, nome: t.nomeCurto },
    emCasa: String(j.casaFid) === String(t.teamFid),
  };
}

for (const ep of dados.epocas) {
  for (const t of ep.equipas) {
    for (const j of t.jogos.filter((x) => x.detalhe && (x.accoes || []).length)) {
      const sim = simularLive(t, j);
      const marca = `${ep.id}/${t.id} ao-vivo simulado ${j.fid}`;
      verificar(marca, desenharLive(t, { atualizado: '2026-01-01 20:00:00', erro: null }, [sim]));
      for (const largura of [390, 820, 1440]) {
        verificar(`${marca} fluxo ${largura}`, G.linhaFluxo(sim, largura) + G.descreverFluxo(sim));
        verificar(`${marca} parciais ${largura}`, G.barrasParciais(sim, largura) + G.descreverParciais(sim));
        if (sim.lideranca) verificar(`${marca} liderança ${largura}`, G.barrasLideranca(sim, largura) + G.descreverLideranca(sim));
      }
    }
  }
}
// Painel de análise: cada separador × cada período, em jogos reais e simulados.
const P = await import(pathToFileURL(path.join(RAIZ, 'app/js/painel.js')).href);
const An = await import(pathToFileURL(path.join(RAIZ, 'app/js/analise.js')).href);
for (const ep of dados.epocas) {
  for (const t of ep.equipas) {
    for (const j0 of t.jogos.filter((x) => x.detalhe && (x.accoes || []).length)) {
      const jr = { ...j0, emCasa: String(j0.casaFid) === String(t.teamFid) };
      for (const j of [jr, simularLive(t, j0)]) {
        for (const [aba] of P.ABAS) {
          for (const per of ['todos', ...An.periodosDe(j)]) {
            P.definirEstado(aba, per);
            verificar(`${ep.id}/${t.id} painel ${j.status === 'LIVE' ? 'live ' : ''}${j0.fid} ${aba} ${per}`, P.painelHTML(j));
            if (aba === 'fluxo') verificar(`  fluxo svg ${j0.fid} ${per}`, G.linhaFluxo(j, 390, per) + G.descreverFluxo(j, per));
          }
        }
      }
      // Números: ações contra boxscore e contra o resultado.
      const T = An.totais(jr, 'todos');
      for (const lado of ['casa', 'fora']) {
        const box = (k) => j0.jogadores[lado].reduce((s, p) => s + (p[k] || 0), 0);
        const x = T[lado];
        const ok = x.ll === box('cll') && x.llf === box('fll') && x.c2 === box('c2')
          && x.c3 === box('c3') && x.ft === box('ft') && x.pts === box('pts')
          && x.pts === x.ll + 2 * x.c2 + 3 * x.c3;
        testes += 1;
        if (!ok) { falhas += 1; console.error(`  FALHA números ${j0.fid} ${lado}: ações ${JSON.stringify(x)} ≠ boxscore`); }
      }
      const soma = An.periodosDe(jr).reduce((s, p) => s + An.totais(jr, p).casa.pts, 0);
      testes += 1;
      if (soma !== T.casa.pts) { falhas += 1; console.error(`  FALHA períodos ${j0.fid}: ${soma} ≠ ${T.casa.pts}`); }
    }
  }
}
P.definirEstado('comp', 'todos');

verificar('ao-vivo sem jogos', desenharLive(dados.epocas[0].equipas[0], { atualizado: null, erro: null }, []));

// A vista da API lê localStorage, que fora do browser não existe: tem de aguentar.
globalThis.location = { origin: 'https://exemplo.test' };
verificar('api', api.render());

console.log(`\n${testes - falhas}/${testes} vistas sem problemas`);
process.exit(falhas ? 1 : 0);
