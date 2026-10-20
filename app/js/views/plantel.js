import * as F from '../format.js';
import * as D from '../data.js';
import { esc, card, vazio } from '../ui.js';

let ordem = { k: 'pts', dir: -1 };
let equipaAtual = null;

const pctTxt = (v) => (v === null || v === undefined ? '—' : `${F.num(v * 100, 0)}%`);

const COLS = [
  { k: 'num', t: '#', cls: 'pos' },
  { k: 'nome', t: 'Jogador', cls: 'name' },
  { k: 'j', t: 'J' },
  { k: 'mpg', t: 'MIN', f: (v) => F.mmss(v) },
  { k: 'pts', t: 'PTS', b: true },
  { k: 'ppg', t: 'PPJ', f: (v) => F.num(v, 1) },
  { k: 'c2', t: '2P' },
  { k: 'c3', t: '3P' },
  { k: 'cll', t: 'LL', f: (v, a) => `${a.cll}/${a.tll}` },
  { k: 'pll', t: 'LL%', f: pctTxt },
  { k: 'ft', t: 'FT' },
  { k: 'fr', t: 'FR' },
  { k: 'val', t: 'VAL' },
  { k: 'pm', t: '+/−' },
];

function valor(a, k) {
  if (k === 'nome') return (a.nome || '').toLowerCase();
  if (k === 'num') return parseInt(a.num, 10) || 999;
  const v = a[k];
  return v === null || v === undefined ? -Infinity : v;
}

function tabela(t) {
  const todos = D.statsPlantel(t);
  const lista = todos.filter((a) => a.j > 0);

  if (!lista.length) {
    return vazio('Sem estatísticas individuais',
      'Ainda não há boxscores desta equipa nesta época.');
  }

  const arr = [...lista].sort((x, y) => {
    const a = valor(x, ordem.k);
    const b = valor(y, ordem.k);
    if (typeof a === 'string' || typeof b === 'string') return ordem.dir * String(a).localeCompare(String(b));
    if (a === b) return y.pts - x.pts;
    return ordem.dir * (a - b);
  });

  const cab = COLS.map((c) => {
    const act = ordem.k === c.k;
    return `<th scope="col" class="sortable ${act ? 'act' : ''} ${c.cls || ''}"
      data-sort="${c.k}" aria-sort="${act ? (ordem.dir === 1 ? 'ascending' : 'descending') : 'none'}">
      ${c.t}${act ? `<span class="arrow">${ordem.dir === 1 ? '↑' : '↓'}</span>` : ''}
    </th>`;
  }).join('');

  const linhas = arr.map((a) => `<tr>
    ${COLS.map((c) => {
      const v = c.f ? c.f(a[c.k], a) : (a[c.k] ?? '—');
      return `<td class="${c.cls || ''}">${c.b ? `<b>${v}</b>` : v}</td>`;
    }).join('')}
  </tr>`).join('');

  const soma = (k) => arr.reduce((s, a) => s + (a[k] || 0), 0);
  const tt = (feitos, tentados) => (tentados ? pctTxt(feitos / tentados) : '—');
  const total = `<tr class="total">
    <td class="pos"></td><td class="name">Total</td>
    <td>${arr.length}</td><td>${F.mmss(soma('min'))}</td>
    <td><b>${soma('pts')}</b></td><td>${F.num(soma('pts') / arr.length, 1)}</td>
    <td>${soma('c2')}</td>
    <td>${soma('c3')}</td>
    <td>${soma('cll')}/${soma('cll') + soma('fll')}</td>
    <td>${tt(soma('cll'), soma('cll') + soma('fll'))}</td>
    <td>${soma('ft')}</td><td>${soma('fr')}</td>
    <td>${soma('val')}</td><td>${soma('pm') > 0 ? '+' : ''}${soma('pm')}</td>
  </tr>`;

  return `<div class="tw"><table class="box">
    <thead><tr>${cab}</tr></thead>
    <tbody>${linhas}${total}</tbody>
  </table></div>`;
}

export default {
  render(t) {
    if (equipaAtual !== t.id) {
      equipaAtual = t.id;
      ordem = { k: 'pts', dir: -1 };
    }
    const n = D.statsPlantel(t).filter((a) => a.j > 0).length;

    return `
      <div class="head-mini">
        <h2>Plantel</h2>
        <span>${n} jogadores utilizados · ${t.plantel.length} inscritos</span>
      </div>
      <section class="card" id="tabela-plantel">${tabela(t)}</section>
      <p class="nota">MIN em minutos:segundos por jogo. PPJ = pontos por jogo.
      2P e 3P são apenas convertidos — a fonte não regista falhados de campo.
      LL mostra convertidos/tentados. VAL = valorização FIBA.
      +/− = diferença de pontos com o jogador em campo.</p>`;
  },

  mount(root, t) {
    const alvo = root.querySelector('#tabela-plantel');
    if (!alvo) return;

    // Delegacao: o cabecalho e substituido a cada ordenacao, por isso o
    // listener tem de viver no contentor, que persiste.
    alvo.addEventListener('click', (e) => {
      const th = e.target.closest('[data-sort]');
      if (!th || !alvo.contains(th)) return;
      const k = th.dataset.sort;
      if (ordem.k === k) ordem.dir *= -1;
      else ordem = { k, dir: k === 'nome' || k === 'num' ? 1 : -1 };
      alvo.innerHTML = tabela(t);
    });
  },
};
