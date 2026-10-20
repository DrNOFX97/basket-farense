import * as F from '../format.js';
import * as D from '../data.js';
import { esc, pill, card, vazio, logo } from '../ui.js';

let filtro = 'todos';
let equipaAtual = null;

const FILTROS = [
  ['todos', 'Todos'],
  ['casa', 'Em casa'],
  ['fora', 'Fora'],
  ['realizados', 'Realizados'],
  ['futuros', 'Por jogar'],
];

function linha(j, mapaL) {
  const adv = j.emCasa ? j.fora : j.casa;
  const advFid = j.emCasa ? j.foraFid : j.casaFid;
  const marcador = j.jogado
    ? `${j.meus}<span class="dash">–</span>${j.adv}`
    : `<span class="mut">${F.hora(j.data) || '—'}</span>`;
  return `<button class="mrow" data-jogo="${esc(j.fid)}" type="button">
    <div class="mdate"><b>${F.dia(j.data)}</b>${F.mes(j.data)}</div>
    <div class="mopp">
      <b class="mteam">${logo(mapaL.get(String(advFid)), 'tlogo-sm')}<span>${esc(adv)}</span></b>
      <span>${j.emCasa ? 'Casa' : 'Fora'}${j.jornada ? ' · ' + esc(j.jornada) : ''}</span>
    </div>
    <div class="mscore ${j.jogado ? '' : 'dim'}">${marcador}</div>
    ${j.jogado ? pill(j.resultado) : '<span class="pill pill-n">·</span>'}
  </button>`;
}

function lista(t) {
  let jogos = t.jogos.slice();
  if (filtro === 'casa') jogos = jogos.filter((j) => j.emCasa);
  else if (filtro === 'fora') jogos = jogos.filter((j) => !j.emCasa);
  else if (filtro === 'realizados') jogos = jogos.filter((j) => j.jogado);
  else if (filtro === 'futuros') jogos = jogos.filter((j) => !j.jogado);

  if (!jogos.length) return vazio('Sem jogos neste filtro', 'Experimenta outro filtro.');

  const grupos = new Map();
  for (const j of jogos) {
    const k = F.chaveMes(j.data);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(j);
  }

  const mapaL = D.logosEquipa(t);
  return [...grupos.values()].map((g) => `
    <div class="month">${esc(F.nomeMes(g[0].data))}</div>
    ${g.map((j) => linha(j, mapaL)).join('')}`).join('');
}

export default {
  render(t) {
    if (equipaAtual !== t.id) {
      equipaAtual = t.id;
      filtro = 'todos';
    }
    const n = (f) => {
      if (f === 'casa') return t.jogos.filter((j) => j.emCasa).length;
      if (f === 'fora') return t.jogos.filter((j) => !j.emCasa).length;
      if (f === 'realizados') return t.jogos.filter((j) => j.jogado).length;
      if (f === 'futuros') return t.jogos.filter((j) => !j.jogado).length;
      return t.jogos.length;
    };

    return `
      <div class="barra-filtros">
        <div class="seg" role="group" aria-label="Filtrar jogos">
          ${FILTROS.map(([k, nome]) => `<button type="button" data-filtro="${k}"
            class="${filtro === k ? 'on' : ''}">${nome}<i>${n(k)}</i></button>`).join('')}
        </div>
      </div>
      <section class="card"><div class="mlist" id="lista-jogos">${lista(t)}</div></section>
      <p class="nota">Os jogos anteriores a 2024 não têm play-by-play detalhado. Os que têm
      boxscore abrem com parciais e estatísticas de jogadores.</p>`;
  },

  mount(root, t) {
    root.querySelectorAll('[data-filtro]').forEach((b) => {
      b.addEventListener('click', () => {
        filtro = b.dataset.filtro;
        root.querySelectorAll('[data-filtro]').forEach((x) => {
          x.classList.toggle('on', x === b);
        });
        root.querySelector('#lista-jogos').innerHTML = lista(t);
      });
    });
  },
};
