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

  const lista = (lado) => ((j.jogadores && j.jogadores[lado]) || []).map((p) => {
    const a = acc.get(String(p.fid)) || { pts: 0, ft: 0 };
    return { fid: p.fid, nome: p.nome, num: p.num, foto: p.foto || null,
      pts: a.pts, ft: a.ft, val: p.val || 0, pm: p.pm || 0, min: p.min || 0 };
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
