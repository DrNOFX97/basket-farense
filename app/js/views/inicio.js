// Página inicial do clube: todos os escalões da época, sem escolher um antes.
// Ao vivo agora, próximos jogos e últimos resultados, cada um com ligação ao
// jogo ou ao escalão. Datas comparadas como texto (hora local, sem fusos).
import * as F from '../format.js';
import * as D from '../data.js';
import { esc, pill, card, vazio, logo } from '../ui.js';

const MAX = 6;

const hrefJogo = (ep, t, j) => `#/${ep.id}/${t.id}/jogo/${j.fid}`;
const hrefEquipa = (ep, t, vista = 'resumo') => `#/${ep.id}/${t.id}/${vista}`;

function nomeEquipa(ep, t) {
  const igual = ep.equipas.filter((x) => x.nomeCurto === t.nomeCurto).length > 1;
  return t.nomeCurto + (igual && t.variante ? ` ${t.variante}` : '');
}

function linha(ep, t, j, realizado) {
  const adv = j.emCasa ? j.fora : j.casa;
  const advFid = j.emCasa ? j.foraFid : j.casaFid;
  const marcador = realizado
    ? `${j.meus}<span class="dash">–</span>${j.adv}`
    : `<span class="mut">${F.hora(j.data) || '—'}</span>`;
  return `<a class="mrow" href="${esc(hrefJogo(ep, t, j))}">
    <div class="mdate"><b>${F.dia(j.data)}</b>${F.mes(j.data)}</div>
    <div class="mopp">
      <b class="mteam">${logo(D.logosEquipa(t).get(String(advFid)), 'tlogo-sm')}<span>${esc(adv)}</span></b>
      <span>${esc(nomeEquipa(ep, t))} · ${j.emCasa ? 'Casa' : 'Fora'}</span>
    </div>
    <div class="mscore ${realizado ? '' : 'dim'}">${marcador}</div>
    ${realizado ? pill(j.resultado) : '<span class="pill pill-n">·</span>'}
  </a>`;
}

function proximos(ep) {
  const lista = ep.equipas
    .map((t) => ({ t, j: D.proximoJogo(t) }))
    .filter((x) => x.j)
    .sort((a, b) => String(a.j.data).localeCompare(String(b.j.data)))
    .slice(0, MAX);
  return card('Próximos jogos', lista.length
    ? lista.map((x) => linha(ep, x.t, x.j, false)).join('')
    : vazio('Sem jogos marcados', 'Ainda não há datas para nenhum escalão.'));
}

function ultimos(ep) {
  const lista = ep.equipas
    .map((t) => ({ t, j: D.ultimoJogo(t) }))
    .filter((x) => x.j)
    .sort((a, b) => String(b.j.data).localeCompare(String(a.j.data)))
    .slice(0, MAX);
  return card('Últimos resultados', lista.length
    ? lista.map((x) => linha(ep, x.t, x.j, true)).join('')
    : vazio('Ainda sem jogos', 'Nenhum escalão disputou jogos nesta época.'));
}

function escaloes(ep) {
  const grupo = (titulo, lista) => (lista.length ? `
    <h3 class="nav-label">${titulo}</h3>
    <div class="ini-grid">${lista.map((t) => {
      const r = t.resumo || {};
      return `<a class="ini-eq" href="${esc(hrefEquipa(ep, t))}">
        <span class="ini-nome">${esc(nomeEquipa(ep, t))}<small>${esc(t.competicao)}</small></span>
        <span class="nav-rec">${r.realizados ? `${r.v}-${r.d}` : '—'}</span>
      </a>`;
    }).join('')}</div>` : '');
  const sen = ep.equipas.filter((t) => t.escalao === 'Seniores');
  const form = ep.equipas.filter((t) => t.escalao !== 'Seniores');
  return card('Escalões', `<div class="card-b">${grupo('Séniores', sen)}${grupo('Formação', form)}</div>`);
}

export default {
  render(ep) {
    return `
      <header class="head">
        <div class="eyebrow">${esc(ep.nome)}</div>
        <h1>SC Farense Basquetebol</h1>
        <p class="comp">Todos os escalões num só sítio.</p>
      </header>
      <div id="ini-vivo" aria-live="polite"></div>
      <div class="grid grid-2">${proximos(ep)}${ultimos(ep)}</div>
      <div style="margin-top:14px">${escaloes(ep)}</div>`;
  },

  // Jogos a decorrer, de qualquer escalão. Falha em silêncio: sem ligação à
  // API simplesmente não aparece o bloco.
  mount(root, ep) {
    const alvo = root.querySelector('#ini-vivo');
    let parar = false;
    const ver = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        const d = await r.json();
        if (parar) return;
        const itens = (d.jogos || []).map((j) => {
          const t = D.equipa(ep.id, j.equipa && j.equipa.id) || D.equipaPorFid(ep.id, j.equipa && j.equipa.teamFid) || ep.equipas[0];
          const [pc, pf] = j.pontos || [0, 0];
          return `<a class="ini-vivo" href="${esc(hrefEquipa(ep, t, 'ao-vivo'))}">
            <span class="live-dot"></span>
            <b>${esc(j.casa)} ${pc ?? 0}–${pf ?? 0} ${esc(j.fora)}</b>
            <span>Ao vivo · ${esc(nomeEquipa(ep, t))}</span>
          </a>`;
        });
        alvo.innerHTML = itens.length ? `<div class="ini-vivos">${itens.join('')}</div>` : '';
      } catch { if (!parar) alvo.innerHTML = ''; }
    };
    ver();
    const id = setInterval(ver, 30000);
    return () => { parar = true; clearInterval(id); };
  },
};
