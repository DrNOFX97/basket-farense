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

const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/farense.json'), 'utf8'));

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

console.log(`\n${testes - falhas}/${testes} vistas sem problemas`);
process.exit(falhas ? 1 : 0);
