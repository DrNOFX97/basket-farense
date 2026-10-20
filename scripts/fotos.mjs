// Gera o mapa de fotos manuais dos jogadores.
//
//   node scripts/fotos.mjs
//
// As imagens vivem em app/fotos/<escalao>/, com o nome do jogador e/ou o FID:
//
//   app/fotos/seniores-m/Gustavo Gonçalves 213344.jpg
//   app/fotos/sub18-m-a/Francisco Diogo 286092.jpg
//
// O script percorre as subpastas, escreve app/fotos/fotos.json (que a app
// carrega) e atualiza app/fotos/jogadores.csv.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.join(RAIZ, 'app', 'fotos');
const DADOS = path.join(RAIZ, 'data', 'farense.json');
const MAPA = path.join(PASTA, 'fotos.json');
const LISTA = path.join(PASTA, 'jogadores.csv');
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
// Se houver mais do que uma versão do mesmo jogador, a cara recortada em PNG
// ganha ao JPEG original.
const PRIORIDADE = new Map([
  ['.png', 0],
  ['.webp', 1],
  ['.jpg', 2],
  ['.jpeg', 3],
  ['.avif', 4],
]);
const prioridade = (nome) => PRIORIDADE.get(path.extname(nome).toLowerCase()) ?? 99;

function normalizar(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const compacto = (s) => normalizar(s).replace(/\s+/g, '');

function csv(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function hashFicheiro(ficheiro) {
  return createHash('sha1').update(fs.readFileSync(ficheiro)).digest('hex').slice(0, 10);
}

function listarImagens(dir, base = '') {
  const saida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entrada.name}` : entrada.name;
    const abs = path.join(dir, entrada.name);
    if (entrada.isDirectory()) saida.push(...listarImagens(abs, rel));
    else if (EXTS.has(path.extname(entrada.name).toLowerCase())) {
      saida.push({ rel, abs, nome: entrada.name });
    }
  }
  return saida;
}

if (!fs.existsSync(DADOS)) {
  console.error('falta data/farense.json');
  process.exit(1);
}

const dados = JSON.parse(fs.readFileSync(DADOS, 'utf8'));
const equipas = new Map();
const jogadores = new Map();

function juntar(p, equipaId) {
  const fid = String(p.fid || '');
  if (!fid) return;
  let j = jogadores.get(fid);
  if (!j) {
    j = { fid, nome: '', num: '', equipas: new Set() };
    jogadores.set(fid, j);
  }
  j.equipas.add(equipaId);
  if (!j.nome && p.nome) j.nome = p.nome;
  if (!j.num && p.num) j.num = p.num;
}

for (const epoca of dados.epocas || []) {
  for (const t of epoca.equipas || []) {
    equipas.set(t.id, t);
    for (const p of t.plantel || []) juntar(p, t.id);
    for (const jogo of t.jogos || []) {
      const lado = String(jogo.casaFid) === String(t.teamFid) ? 'casa' : 'fora';
      for (const p of (jogo.jogadores && jogo.jogadores[lado]) || []) juntar(p, t.id);
    }
  }
}

const porNome = new Map();
for (const j of jogadores.values()) {
  const chave = compacto(j.nome);
  if (!chave) continue;
  if (!porNome.has(chave)) porNome.set(chave, []);
  porNome.get(chave).push(j.fid);
}

// Prepara uma pasta por escalão, mesmo que ainda não tenha fotos.
fs.mkdirSync(PASTA, { recursive: true });
for (const equipaId of equipas.keys()) {
  const dir = path.join(PASTA, equipaId);
  fs.mkdirSync(dir, { recursive: true });
  const keep = path.join(dir, '.gitkeep');
  if (!fs.existsSync(keep)) fs.writeFileSync(keep, '');
}

const ficheiros = listarImagens(PASTA).sort((a, b) =>
  prioridade(a.nome) - prioridade(b.nome) || a.rel.localeCompare(b.rel, 'pt'));
const mapa = {};
const arquivo = {};
const avisos = [];

for (const f of ficheiros) {
  const ext = path.extname(f.nome);
  const stem = path.basename(f.nome, ext);
  const partes = f.rel.split('/');
  const pasta = partes.length > 1 ? partes[0] : '';
  let fid = null;

  const numeros = [...new Set([...stem.matchAll(/\d+/g)].map((m) => m[0]))];
  const fidsNoNome = numeros.filter((n) => jogadores.has(n));

  if (fidsNoNome.length === 1) {
    fid = fidsNoNome[0];
  } else if (fidsNoNome.length > 1) {
    avisos.push(`${f.rel}: mais de um FID no nome (${fidsNoNome.join(', ')}); ignorado`);
    continue;
  } else {
    const candidatos = porNome.get(compacto(stem.replace(/\d+/g, ' '))) || [];
    if (candidatos.length === 1) fid = candidatos[0];
    else if (candidatos.length > 1) {
      avisos.push(`${f.rel}: nome ambíguo (${candidatos.join(', ')}); usa o FID`);
    } else {
      avisos.push(`${f.rel}: não encontrei jogador com este nome nem com um FID válido`);
    }
  }

  if (!fid) continue;
  if (pasta && !equipas.has(pasta)) {
    avisos.push(`${f.rel}: a pasta "${pasta}" não é um escalão conhecido`);
  }
  if (pasta && !jogadores.get(fid).equipas.has(pasta)) {
    avisos.push(`${f.rel}: ${jogadores.get(fid).nome} não está no escalão ${pasta}`);
  }
  if (!pasta) {
    avisos.push(`${f.rel}: a foto deve ficar numa subpasta de escalão`);
  }
  if (mapa[fid]) {
    // O PNG já foi processado primeiro; o JPEG equivalente é ignorado em
    // silêncio. Só avisa se houver duas versões com a mesma prioridade.
    if (prioridade(f.nome) === prioridade(arquivo[fid])) {
      avisos.push(`${f.rel}: FID ${fid} já tinha ${arquivo[fid]}; ignorado`);
    }
    continue;
  }

  const v = hashFicheiro(f.abs);
  const url = `/fotos/${f.rel.split('/').map(encodeURIComponent).join('/')}?v=${v}`;
  mapa[fid] = url;
  arquivo[fid] = f.rel;
}

const ordenado = Object.fromEntries(Object.entries(mapa)
  .sort(([a], [b]) => a.localeCompare(b, 'pt', { numeric: true })));
fs.writeFileSync(MAPA, `${JSON.stringify(ordenado, null, 2)}\n`);

const linhas = [['equipa_id', 'equipa', 'numero', 'nome', 'fid', 'pasta', 'ficheiro_sugerido', 'foto']];
for (const epoca of dados.epocas || []) {
  for (const t of epoca.equipas || []) {
    const lista = [...(t.plantel || [])];
    for (const jogo of t.jogos || []) {
      const lado = String(jogo.casaFid) === String(t.teamFid) ? 'casa' : 'fora';
      for (const p of (jogo.jogadores && jogo.jogadores[lado]) || []) {
        if (!lista.some((x) => String(x.fid) === String(p.fid))) lista.push(p);
      }
    }
    lista.sort((a, b) => (parseInt(a.num, 10) || 999) - (parseInt(b.num, 10) || 999)
      || String(a.nome).localeCompare(String(b.nome), 'pt'));

    const vistos = new Set();
    for (const p of lista) {
      const fid = String(p.fid || '');
      if (!fid || vistos.has(fid)) continue;
      vistos.add(fid);
      const nome = String(p.nome || '').replace(/[\\/:*?"<>|]/g, '-').trim();
      linhas.push([
        t.id, t.nomeCurto, p.num || '', p.nome || '', fid, t.id,
        `${t.id}/${nome} ${fid}.jpg`, mapa[fid] || '',
      ]);
    }
  }
}

fs.writeFileSync(LISTA, `\uFEFF${linhas.map((l) => l.map(csv).join(',')).join('\r\n')}\r\n`, 'utf8');

const comFoto = Object.keys(ordenado).length;
console.log(`${comFoto} foto(s) mapeada(s) em ${path.relative(RAIZ, MAPA)}`);
console.log(`${equipas.size} pasta(s) de escalão em ${path.relative(RAIZ, PASTA)}`);
console.log(`lista de jogadores em ${path.relative(RAIZ, LISTA)}`);
if (comFoto < jogadores.size) {
  console.log(`faltam ${jogadores.size - comFoto} jogador(es) sem foto`);
}
for (const a of avisos) console.warn(`  ! ${a}`);
