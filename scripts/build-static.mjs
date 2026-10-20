// Prepara a versão estática para o Netlify.
//
//   node scripts/build-static.mjs
//
// Junta o que o servidor Python serve em dois sítios (app/ e data/) numa única
// pasta publicável, e gera a lista de equipas que a função /api/live usa para
// construir a agenda.
//
// Não há bundler: o que sai em dist/ é exactamente o que está em app/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
const DADOS = path.join(RAIZ, 'data', 'farense.json');
const EQUIPAS = path.join(RAIZ, 'netlify', 'lib', 'equipas.mjs');

function copiar(origem, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const entrada of fs.readdirSync(origem, { withFileTypes: true })) {
    const de = path.join(origem, entrada.name);
    const para = path.join(destino, entrada.name);
    if (entrada.isDirectory()) copiar(de, para);
    else fs.copyFileSync(de, para);
  }
}

if (!fs.existsSync(DADOS)) {
  console.error('falta data/farense.json — corre primeiro: python3 build_data.py');
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
copiar(path.join(RAIZ, 'app'), DIST);

// Data/hora desta publicação. É distinta do "gerado" dos dados: as fotos e a
// interface mudam a cada deploy, mas o JSON da NBN23 só muda quando é gerado.
fs.writeFileSync(
  path.join(DIST, 'versao.json'),
  JSON.stringify({ construido: new Date().toISOString() }) + '\n',
);

// O CSS bloqueia o primeiro render: no ficheiro publicado vai dentro do HTML,
// poupando um pedido (~0,5 s em 4G lento). Em app/ continua como <link>, para
// o servidor local e a edição não mudarem.
{
  const htmlPath = path.join(DIST, 'index.html');
  const css = fs.readFileSync(path.join(RAIZ, 'app', 'css', 'app.css'), 'utf8');
  const ligacao = '<link rel="stylesheet" href="/css/app.css">';
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes(ligacao)) {
    console.error('index.html já não tem a ligação ao CSS esperada — o inline foi ignorado');
    process.exit(1);
  }
  fs.writeFileSync(htmlPath, html.replace(ligacao, () => `<style>\n${css}</style>`));
}

fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.copyFileSync(DADOS, path.join(DIST, 'data', 'farense.json'));

const dados = JSON.parse(fs.readFileSync(DADOS, 'utf8'));

const vistos = new Set();
const equipas = [];
for (const epoca of dados.epocas) {
  for (const t of epoca.equipas) {
    const chave = `${t.projectKey}|${t.compFid}|${t.teamFid}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    equipas.push({
      id: t.id,
      nome: t.nomeCurto,
      projectKey: t.projectKey,
      compFid: t.compFid,
      teamFid: t.teamFid,
      competicao: t.competicao,
      epoca: t.epoca,
    });
  }
}

fs.mkdirSync(path.dirname(EQUIPAS), { recursive: true });
fs.writeFileSync(
  EQUIPAS,
  '// Gerado por scripts/build-static.mjs a partir de data/farense.json.\n'
  + '// Não editar à mão: volta a ser escrito no próximo build.\n'
  + `export default ${JSON.stringify(equipas, null, 2)};\n`,
);

const tamanho = (p) => (fs.statSync(p).size / 1024).toFixed(0);
const ficheiros = [];
(function contar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) contar(p);
    else ficheiros.push(p);
  }
})(DIST);

console.log(`dist/          ${tamanho(path.join(DIST, 'data', 'farense.json'))} KB de dados, ${ficheiros.length} ficheiros`);
console.log(`equipas.mjs    ${equipas.length} equipas para a função ao vivo`);
