// Carregamento e derivação de dados. Tudo o que as vistas precisam de calcular
// a partir do JSON vive aqui, para não haver contas espalhadas pelo interface.

let DADOS = null;

export async function carregar() {
  const r = await fetch('/data/farense.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`o servidor respondeu ${r.status}`);
  DADOS = await r.json();
  if (!DADOS.epocas || !DADOS.epocas.length) throw new Error('o ficheiro de dados está vazio');
  return DADOS;
}

export function dados() { return DADOS; }

export function epocas() { return DADOS ? DADOS.epocas : []; }

export function epoca(id) {
  return epocas().find((e) => e.id === id) || null;
}

export function equipa(epocaId, equipaId) {
  const e = epoca(epocaId);
  return e ? e.equipas.find((t) => t.id === equipaId) || null : null;
}

export function equipaPorFid(epocaId, fid) {
  const e = epoca(epocaId);
  if (!e) return null;
  return e.equipas.find((t) => t.teamFid === String(fid)) || null;
}

// Primeira época com jogos realizados (a mais recente), e a primeira equipa.
export function arranque() {
  const lista = epocas();
  const e = lista[lista.length - 1] || lista[0];
  return { epoca: e.id, equipa: e.equipas[0].id };
}

export function realizados(t) {
  return t.jogos.filter((j) => j.jogado);
}

export function futuros(t) {
  return t.jogos.filter((j) => !j.jogado);
}

export function proximoJogo(t) {
  const f = futuros(t);
  return f.length ? f[0] : null;
}

export function ultimoJogo(t) {
  const r = realizados(t);
  return r.length ? r[r.length - 1] : null;
}

export function forma(t, n = 5) {
  return realizados(t).slice(-n);
}

export function jogo(t, fid) {
  return t.jogos.find((j) => String(j.fid) === String(fid)) || null;
}

// Agrega as linhas de todos os boxscores do jogador na época.
export function statsPlantel(t) {
  const mapa = new Map();
  const campos = ['min', 'pts', 'c2', 'f2', 'c3', 'f3', 'cll', 'fll', 'ft', 'fr', 'val', 'pm'];

  for (const j of t.jogos) {
    if (!j.detalhe) continue;
    const lado = String(j.casaFid) === String(t.teamFid) ? 'casa' : 'fora';
    for (const p of (j.jogadores && j.jogadores[lado]) || []) {
      let a = mapa.get(p.fid);
      if (!a) {
        a = { fid: p.fid, nome: p.nome, num: p.num, j: 0 };
        for (const k of campos) a[k] = 0;
        mapa.set(p.fid, a);
      }
      a.j += 1;
      for (const k of campos) a[k] += p[k] || 0;
      if (p.num && !a.num) a.num = p.num;
    }
  }

  // Junta quem está no plantel mas ainda não jogou.
  for (const p of t.plantel || []) {
    if (!mapa.has(p.fid)) {
      const a = { fid: p.fid, nome: p.nome, num: p.num, j: 0 };
      for (const k of campos) a[k] = 0;
      mapa.set(p.fid, a);
    } else if (!mapa.get(p.fid).nome) {
      mapa.get(p.fid).nome = p.nome;
    }
  }

  const lista = [...mapa.values()].map((a) => ({
    ...a,
    ppg: a.j ? a.pts / a.j : 0,
    mpg: a.j ? a.min / a.j : 0,
    valpg: a.j ? a.val / a.j : 0,
    // A plataforma não registra lançamentos de campo falhados: só existem
    // convertidos. Tentativas de 2 e 3 pontos são desconhecidas.
    t2: null,
    t3: null,
    tll: a.cll + a.fll,
    p2: null,
    p3: null,
    pll: a.cll + a.fll ? a.cll / (a.cll + a.fll) : null,
    tca: null,
    tct: a.c2 + a.c3 + a.cll,
  }));

  lista.sort((x, y) => y.pts - x.pts || y.j - x.j || x.nome.localeCompare(y.nome));
  return lista;
}

// Totais de uma equipa num jogo, a partir do boxscore.
export function totaisJogo(lista) {
  const t = { pts: 0, c2: 0, f2: 0, c3: 0, f3: 0, cll: 0, fll: 0, ft: 0, fr: 0, val: 0, pm: 0, min: 0 };
  for (const p of lista || []) {
    for (const k of Object.keys(t)) t[k] += p[k] || 0;
  }
  t.tca = null;
  t.tct = t.c2 + t.c3 + t.cll;
  t.p2 = null;
  t.p3 = null;
  t.pll = t.cll + t.fll ? t.cll / (t.cll + t.fll) : null;
  return t;
}

// Totais da equipa na época, somando os boxscores jogo a jogo.
// Ao contrário do agregado da API, os falhados são reconstruídos a partir das
// acções, por isso as percentagens de lançamento são fiáveis.
export function totaisEquipa(t) {
  const lista = statsPlantel(t);
  const s = (k) => lista.reduce((x, a) => x + (a[k] || 0), 0);
  const c2 = s('c2'); const f2 = s('f2');
  const c3 = s('c3'); const f3 = s('f3');
  const cll = s('cll'); const fll = s('fll');
  return {
    c2, f2, c3, f3, cll, fll,
    t2: null, t3: null, tll: cll + fll,
    p2: null,
    p3: null,
    pll: cll + fll ? cll / (cll + fll) : null,
    pts: s('pts'), ft: s('ft'), fr: s('fr'), val: s('val'), pm: s('pm'),
    min: s('min'),
    boxscores: t.jogos.filter((j) => j.detalhe).length,
    jogados: t.jogos.filter((j) => j.jogado).length,
  };
}

// Nomes dos jogadores das duas equipas, para traduzir as acções.
export function nomesJogo(j) {
  const mapa = {};
  for (const lado of ['casa', 'fora']) {
    for (const p of (j.jogadores && j.jogadores[lado]) || []) {
      if (p.fid) mapa[String(p.fid)] = p.nome;
    }
  }
  return mapa;
}

// Classificação: devolve o grupo e as linhas, com a equipa marcada.
export function classificacao(t) {
  const g = (t.classificacao || [])[0];
  if (!g) return null;
  return {
    grupo: g.grupo,
    linhas: (g.linhas || []).map((l) => ({ ...l, eu: String(l.fid) === String(t.teamFid) })),
  };
}

export function posicao(t) {
  const c = classificacao(t);
  if (!c) return null;
  const l = c.linhas.find((x) => x.eu);
  return l ? l.pos : null;
}
