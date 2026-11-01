// Cálculos sobre o log de ações de um jogo. Funções puras, sem DOM, para
// poderem ser testadas em Node (scripts/check-views.mjs).
//
// O log só tem cinco tipos de evento (POINTS, FOUL, RECEIVE, SWAP, TIMEOUT) e
// só regista lançamentos de campo convertidos. Por isso só se calcula o que
// estes eventos permitem: nunca percentagens de lançamento de campo.
//
// O campo "tempo" de cada ação é o que falta no período, em milissegundos
// (600000 no início, 0 no fim). Os períodos 1–4 têm 10 min; os prolongamentos 5 min.

export const PERIODO_MS = 600000;
export const PROLONG_MS = 300000;
export const RACHA_MIN = 6;

export const duracaoPeriodo = (p) => (p <= 4 ? PERIODO_MS : PROLONG_MS);
export const inicioPeriodo = (p) => (p <= 4 ? (p - 1) * PERIODO_MS : 4 * PERIODO_MS + (p - 5) * PROLONG_MS);

export function nomePeriodo(p) {
  if (p <= 4) return `P${p}`;
  return p === 5 ? 'Prol.' : `Prol. ${p - 4}`;
}

// Instante absoluto da ação, em ms desde o início do jogo.
export const instante = (a) => inicioPeriodo(a[0]) + duracaoPeriodo(a[0]) - (a[1] || 0);

export function accoesOrdenadas(j) {
  return [...(j.accoes || [])].sort((a, b) => (a[0] - b[0]) || (b[1] - a[1])
    || String(a[9] || '').localeCompare(String(b[9] || '')));
}

// Períodos que existem no jogo (1..n). Ao vivo inclui o período em curso.
export function periodosDe(j) {
  const n = Math.max(
    1,
    (j.parciais || []).length,
    Number(j.periodo) || 0,
    ...(j.accoes || []).map((a) => a[0] || 0),
  );
  return Array.from({ length: n }, (_, i) => i + 1);
}

export function filtrar(j, per) {
  const todas = accoesOrdenadas(j);
  return per === 'todos' || per == null ? todas : todas.filter((a) => a[0] === per);
}

function tipoPontos(a) {
  const [, , , , , sub, val] = a;
  if (sub === 'FREE_THROW') return 'll';
  if (sub === 'OUT_ARC') return 'c3';
  if (sub === 'IN_ARC' || sub === 'DUNK') return 'c2';
  return val === 1 ? 'll' : val === 3 ? 'c3' : 'c2';
}

const vazio = () => ({ ll: 0, llf: 0, c2: 0, c3: 0, pts: 0, ft: 0, tecnicas: 0, fr: 0, timeouts: 0 });

// Totais das duas equipas, a partir das ações do período pedido.
// ft = faltas de jogadores (coincide com o boxscore); tecnicas = faltas do
// banco ou do treinador, que o boxscore dos jogadores não conta.
export function totais(j, per = 'todos') {
  const out = { casa: vazio(), fora: vazio() };
  const lado = (a) => (String(a[8]) === String(j.casaFid) ? out.casa
    : String(a[8]) === String(j.foraFid) ? out.fora : null);
  for (const a of filtrar(j, per)) {
    const t = lado(a);
    if (!t) continue;
    const [, , , actor, code, , val, ok] = a;
    if (code === 'POINTS') {
      const k = tipoPontos(a);
      if (ok) {
        t[k] += 1;
        t.pts += val || (k === 'll' ? 1 : k === 'c3' ? 3 : 2);
      } else if (k === 'll') {
        t.llf += 1;
      }
    } else if (code === 'FOUL') {
      if (actor === 'PLAYER') t.ft += 1;
      else t.tecnicas += 1;
    } else if (code === 'RECEIVE') {
      t.fr += 1;
    } else if (code === 'TIMEOUT') {
      t.timeouts += 1;
    }
  }
  return out;
}

// Marcador ao longo do jogo (diferença nós − eles), rachas e trocas de liderança.
// Com um período escolhido, o marcador recomeça a zero nesse período.
export function fluxo(j, per = 'todos') {
  const nosCasa = !!j.emCasa;
  const meu = String(nosCasa ? j.casaFid : j.foraFid);
  const pts = [{ t: per === 'todos' ? 0 : inicioPeriodo(per), d: 0, nos: 0, eles: 0, per: per === 'todos' ? 1 : per, tempo: per === 'todos' ? PERIODO_MS : duracaoPeriodo(per) }];
  const rachas = [];
  const trocas = [];
  let nos = 0;
  let eles = 0;
  let maiorNos = 0;
  let maiorEles = 0;
  let empates = 0;
  let sinal = 0; // sinal da última liderança (ignora empates)
  let run = null;

  const fecha = () => {
    if (run && run.pts >= RACHA_MIN) rachas.push(run);
    run = null;
  };

  for (const a of filtrar(j, per)) {
    const [p, tempo, , , code, , val, ok, eq] = a;
    if (code !== 'POINTS' || !ok) continue;
    const meus = String(eq) === meu;
    const v = val || 0;
    const antes = nos - eles;
    if (meus) nos += v; else eles += v;
    const d = nos - eles;
    const t = instante(a);
    pts.push({ t, d, nos, eles, per: p, tempo });

    if (run && run.nos === meus) {
      run.pts += v; run.t1 = t; run.fim = { per: p, tempo };
    } else {
      fecha();
      run = { nos: meus, pts: v, t0: t, t1: t, ini: { per: p, tempo }, fim: { per: p, tempo } };
    }

    maiorNos = Math.max(maiorNos, d);
    maiorEles = Math.max(maiorEles, -d);
    if (d === 0 && antes !== 0) empates += 1;
    const s = Math.sign(d);
    if (s !== 0) {
      if (sinal !== 0 && s !== sinal) trocas.push({ t, idx: pts.length - 1, para: s > 0 ? 'nos' : 'eles' });
      sinal = s;
    }
  }
  fecha();

  return { pts, rachas, trocas, empates, maiorNos, maiorEles, nos, eles };
}

// Melhores de cada equipa. Pontos e faltas vêm das ações (respeitam o filtro
// de período); valorização, +/- e minutos só existem para o jogo inteiro.
export function lideres(j, per = 'todos') {
  const acc = new Map();
  const ref = (fid) => {
    if (!acc.has(fid)) acc.set(fid, { pts: 0, ft: 0 });
    return acc.get(fid);
  };
  for (const a of filtrar(j, per)) {
    const [, , fid, actor, code, , val, ok] = a;
    if (actor !== 'PLAYER' || !fid) continue;
    if (code === 'POINTS' && ok) ref(String(fid)).pts += val || 0;
    else if (code === 'FOUL') ref(String(fid)).ft += 1;
  }

  const mins = minutos(j, per);
  const lista = (lado) => ((j.jogadores && j.jogadores[lado]) || []).map((p) => {
    const a = acc.get(String(p.fid)) || { pts: 0, ft: 0 };
    return { fid: p.fid, nome: p.nome, num: p.num, foto: p.foto || null,
      pts: a.pts, ft: a.ft, val: p.val || 0, pm: p.pm || 0, min: mins[lado].get(String(p.fid)) || 0 };
  });

  const melhor = (jog, k) => {
    if (!jog.length) return null;
    const ordenado = [...jog].sort((x, y) => (y[k] - x[k]) || (y.min - x.min));
    const top = ordenado[0];
    const empatados = ordenado.filter((x) => x[k] === top[k]).length - 1;
    return { ...top, valor: top[k], empatados };
  };

  const por = (jog) => ({
    pts: melhor(jog, 'pts'), val: melhor(jog, 'val'), pm: melhor(jog, 'pm'),
    ft: melhor(jog, 'ft'), min: melhor(jog, 'min'),
  });
  const casa = lista('casa');
  const fora = lista('fora');
  return { casa: por(casa), fora: por(fora) };
}

// ------------------------------------------------------------ tempo em campo
// Instante actual do jogo ao vivo (ms desde o início). O relógio do marcador
// vem em segundos ou em ms; abaixo de 36000 assume-se segundos (um período
// tem 600 s ou 600000 ms).
export function instanteAgora(j) {
  const n = periodosDe(j).length;
  const fimRegulamentar = inicioPeriodo(Math.max(4, n) + 1);
  if (j.status === 'LIVE' && j.periodo && j.relogio != null) {
    const resta = j.relogio > 36000 ? j.relogio : j.relogio * 1000;
    return Math.min(fimRegulamentar, inicioPeriodo(j.periodo) + duracaoPeriodo(j.periodo) - resta);
  }
  // Jogo terminado: fim do último período jogado.
  const ultimo = Math.max(...periodosDe(j));
  return inicioPeriodo(ultimo) + duracaoPeriodo(ultimo);
}

// Janela [de, ate] em ms de um período, ou do jogo todo.
function janela(j, per) {
  const fim = instanteAgora(j);
  if (per === 'todos' || per == null) return [0, fim];
  return [inicioPeriodo(per), Math.min(fim, inicioPeriodo(per) + duracaoPeriodo(per))];
}

// Tempo em campo de cada jogador, +/- e quintetos, a partir das substituições.
// As entradas e saídas descrevem o que muda em relação ao que já está em campo
// (incluindo no início de cada período), por isso mantém-se o conjunto em campo
// ao longo de todo o jogo e acumula-se o tempo entre ações.
// Devolve { casa, fora } com { jogadores: Map fid → {ms, pm}, quintetos: [...] }.
export function tempoEmCampo(j, per = 'todos') {
  const [w0, w1] = janela(j, per);
  const eq = { casa: String(j.casaFid), fora: String(j.foraFid) };
  const campo = { casa: new Set(), fora: new Set() };
  const res = { casa: { jogadores: new Map(), quintetos: new Map() }, fora: { jogadores: new Map(), quintetos: new Map() } };
  const ref = (lado, fid) => {
    const m = res[lado].jogadores;
    if (!m.has(fid)) m.set(fid, { fid, ms: 0, pm: 0 });
    return m.get(fid);
  };
  const quinteto = (lado) => {
    const chave = [...campo[lado]].sort().join('|');
    const q = res[lado].quintetos;
    if (!q.has(chave)) q.set(chave, { fids: [...campo[lado]].sort(), ms: 0, pro: 0, contra: 0 });
    return q.get(chave);
  };

  let cursor = 0;
  const acumula = (ate) => {
    const de = Math.max(cursor, w0);
    const a = Math.min(ate, w1);
    if (a > de) {
      for (const lado of ['casa', 'fora']) {
        if (!campo[lado].size) continue;
        for (const fid of campo[lado]) ref(lado, fid).ms += a - de;
        quinteto(lado).ms += a - de;
      }
    }
    cursor = Math.max(cursor, ate);
  };

  for (const a of accoesOrdenadas(j)) {
    const t = instante(a);
    const [, , fid, , code, sub, val, ok, equipa] = a;
    const lado = String(equipa) === eq.casa ? 'casa' : String(equipa) === eq.fora ? 'fora' : null;
    if (!lado) continue;
    acumula(t);
    if (code === 'SWAP' && fid) {
      if (sub === 'SWAP_IN') campo[lado].add(String(fid));
      else if (sub === 'SWAP_OUT') campo[lado].delete(String(fid));
    } else if (code === 'POINTS' && ok && t >= w0 && t <= w1) {
      // Pontos contam para o +/- de quem está em campo no momento.
      const outro = lado === 'casa' ? 'fora' : 'casa';
      for (const f of campo[lado]) ref(lado, f).pm += val || 0;
      for (const f of campo[outro]) ref(outro, f).pm -= val || 0;
      if (campo[lado].size) quinteto(lado).pro += val || 0;
      if (campo[outro].size) quinteto(outro).contra += val || 0;
    }
  }
  acumula(w1);

  const fim = (lado) => ({
    jogadores: res[lado].jogadores,
    quintetos: [...res[lado].quintetos.values()].filter((q) => q.ms > 0).sort((x, y) => y.ms - x.ms),
  });
  return { casa: fim('casa'), fora: fim('fora') };
}

// -------------------------------------------------------------------- faltas
export const FALTAS_BONUS = 5; // 5.ª falta de equipa no período: lances livres
export const FALTAS_ELIMINACAO = 5;

const ladoDe = (j, a) => (String(a[8]) === String(j.casaFid) ? 'casa'
  : String(a[8]) === String(j.foraFid) ? 'fora' : null);

// Faltas de jogadores por equipa e período (as técnicas do banco não contam).
export function faltasPorPeriodo(j) {
  const pers = periodosDe(j);
  const out = { casa: pers.map(() => 0), fora: pers.map(() => 0) };
  for (const a of j.accoes || []) {
    const lado = ladoDe(j, a);
    if (lado && a[4] === 'FOUL' && a[3] === 'PLAYER' && out[lado][a[0] - 1] !== undefined) out[lado][a[0] - 1] += 1;
  }
  return { pers, ...out };
}

// Jogadores com 4 ou mais faltas, e o momento em que chegaram a 4 e a 5.
export function emRisco(j) {
  const por = new Map();
  for (const a of accoesOrdenadas(j)) {
    if (a[4] !== 'FOUL' || a[3] !== 'PLAYER' || !a[2]) continue;
    const lado = ladoDe(j, a);
    if (!lado) continue;
    const k = String(a[2]);
    if (!por.has(k)) por.set(k, { fid: k, lado, faltas: [] });
    por.get(k).faltas.push({ per: a[0], tempo: a[1] });
  }
  const nomes = new Map();
  for (const lado of ['casa', 'fora']) {
    for (const p of (j.jogadores && j.jogadores[lado]) || []) nomes.set(String(p.fid), p);
  }
  return [...por.values()].filter((p) => p.faltas.length >= FALTAS_ELIMINACAO - 1)
    .map((p) => ({
      ...p,
      nome: (nomes.get(p.fid) || {}).nome || '—',
      ft: p.faltas.length,
      quarta: p.faltas[FALTAS_ELIMINACAO - 2],
      quinta: p.faltas[FALTAS_ELIMINACAO - 1] || null,
    }))
    .sort((x, y) => y.ft - x.ft || x.nome.localeCompare(y.nome));
}

// ------------------------------------------------------------- lances livres
// Convertidos e falhados por jogador. Os lances livres são o único lançamento
// que a fonte regista por inteiro (convertidos e falhados).
export function lancesLivres(j, per = 'todos') {
  const acc = new Map();
  for (const a of filtrar(j, per)) {
    if (a[4] !== 'POINTS' || a[5] !== 'FREE_THROW') continue;
    const lado = ladoDe(j, a);
    if (!lado) continue;
    const k = `${lado}:${a[2] || 'equipa'}`;
    if (!acc.has(k)) acc.set(k, { lado, fid: a[2] ? String(a[2]) : null, ll: 0, llf: 0 });
    acc.get(k)[a[7] ? 'll' : 'llf'] += 1;
  }
  const nomes = new Map();
  for (const lado of ['casa', 'fora']) {
    for (const p of (j.jogadores && j.jogadores[lado]) || []) nomes.set(String(p.fid), p);
  }
  const lista = (lado) => [...acc.values()].filter((x) => x.lado === lado).map((x) => ({
    ...x, nome: x.fid ? (nomes.get(x.fid) || {}).nome || '—' : 'Equipa',
    foto: x.fid ? (nomes.get(x.fid) || {}).foto || null : null,
    tentados: x.ll + x.llf,
  })).sort((a, b) => b.tentados - a.tentados || b.ll - a.ll || a.nome.localeCompare(b.nome));
  return { casa: lista('casa'), fora: lista('fora') };
}

// ------------------------------------------------------------------ timeouts
// Descontos de tempo por ordem, com o marcador no momento do pedido.
export function timeouts(j, per = 'todos') {
  const out = [];
  let casa = 0;
  let fora = 0;
  for (const a of accoesOrdenadas(j)) {
    const lado = ladoDe(j, a);
    if (!lado) continue;
    if (a[4] === 'POINTS' && a[7]) {
      if (lado === 'casa') casa += a[6] || 0; else fora += a[6] || 0;
    } else if (a[4] === 'TIMEOUT' && (per === 'todos' || a[0] === per)) {
      out.push({ per: a[0], tempo: a[1], lado, casa, fora });
    }
  }
  return out;
}

// Segundos em campo de cada jogador. Jogo inteiro: minutos do boxscore (fonte
// oficial). Por período: calculados das substituições.
export function minutos(j, per = 'todos') {
  const out = { casa: new Map(), fora: new Map() };
  const tc = per === 'todos' ? null : tempoEmCampo(j, per);
  for (const lado of ['casa', 'fora']) {
    for (const p of (j.jogadores && j.jogadores[lado]) || []) {
      out[lado].set(String(p.fid), tc
        ? Math.round(((tc[lado].jogadores.get(String(p.fid)) || {}).ms || 0) / 1000)
        : (p.min || 0));
    }
  }
  return out;
}
