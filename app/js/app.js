import {
  carregar, dados, epocas, epoca, equipa, arranque, posicao,
} from './data.js';
import * as F from './format.js';
import { esc, chip } from './ui.js';

import resumo from './views/resumo.js';
import jogos from './views/jogos.js';
import jogo from './views/jogo.js';
import classificacao from './views/classificacao.js';
import plantel from './views/plantel.js';
import aovivo from './views/aovivo.js';

const VISTAS = {
  resumo, jogos, jogo, classificacao, plantel, 'ao-vivo': aovivo,
};

const TABS = [
  ['resumo', 'Resumo'],
  ['jogos', 'Jogos'],
  ['classificacao', 'Classificação'],
  ['plantel', 'Plantel'],
  ['ao-vivo', 'Ao vivo'],
];

let limpar = null;

// ------------------------------------------------------------------ rotas --
function parse() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  const p = raw.split('/').filter(Boolean);
  return {
    epoca: p[0] || null,
    equipa: p[1] || null,
    vista: p[2] || 'resumo',
    param: p[3] || null,
  };
}

function href(epocaId, equipaId, vista = 'resumo', param = null) {
  return `#/${epocaId}/${equipaId}/${vista}${param ? `/${param}` : ''}`;
}

// ---------------------------------------------------------------- sidebar --
function gruposDe(ep) {
  const seniores = ep.equipas.filter((t) => t.escalao === 'Seniores');
  const formacao = ep.equipas.filter((t) => t.escalao !== 'Seniores');
  return { seniores, formacao };
}

function itemNav(t, ativa, duplicados) {
  const r = t.resumo || {};
  const reg = r.realizados ? `${r.v}-${r.d}` : '—';
  const marca = duplicados.has(t.nomeCurto)
    ? `<span class="nav-var">${esc(t.variante || '?')}</span>` : '';
  return `<button type="button" class="nav-item ${ativa ? 'on' : ''}"
    data-equipa="${esc(t.id)}" title="${esc(t.competicao)}"
    ${ativa ? 'aria-current="page"' : ''}>
    <span class="nav-name">${esc(t.nomeCurto)}</span>
    ${marca}
    <span class="nav-rec">${esc(reg)}</span>
  </button>`;
}

function desenharSidebar(ep, tAtual) {
  const { seniores, formacao } = gruposDe(ep);
  const contagem = {};
  for (const t of ep.equipas) contagem[t.nomeCurto] = (contagem[t.nomeCurto] || 0) + 1;
  const duplicados = new Set(Object.keys(contagem).filter((k) => contagem[k] > 1));

  document.getElementById('season').innerHTML = epocas().map((e) => `
    <button type="button" data-epoca="${esc(e.id)}"
      class="${e.id === ep.id ? 'on' : ''}"
      aria-pressed="${e.id === ep.id}">${esc(e.nome)}</button>`).join('');

  let html = '';
  if (seniores.length) {
    html += '<div class="nav-label">Séniores</div>';
    html += seniores.map((t) => itemNav(t, t.id === tAtual.id, duplicados)).join('');
  }
  if (formacao.length) {
    html += '<div class="nav-label">Formação</div>';
    html += formacao.map((t) => itemNav(t, t.id === tAtual.id, duplicados)).join('');
  }
  document.getElementById('nav').innerHTML = html;

  const nota = document.getElementById('foot-note');
  const g = dados();
  nota.innerHTML = `${ep.equipas.length} escalões · dados NBN23`
    + (g && g.gerado ? `<br>actualizado ${esc(g.gerado)}` : '');
  document.getElementById('live-link').setAttribute('href', href(ep.id, tAtual.id, 'ao-vivo'));
}

// ----------------------------------------------------------------- mobile --
function desenharMobile(ep, t) {
  const { seniores, formacao } = gruposDe(ep);
  const opt = (lista) => lista.map((x) => `
    <option value="${esc(x.id)}" ${x.id === t.id ? 'selected' : ''}>${esc(x.nomeCurto)}</option>`).join('');

  let html = '';
  if (seniores.length) html += `<optgroup label="Séniores">${opt(seniores)}</optgroup>`;
  if (formacao.length) html += `<optgroup label="Formação">${opt(formacao)}</optgroup>`;

  document.getElementById('sel-equipa').innerHTML = html;
  document.getElementById('sel-equipa').value = t.id;

  const curto = (nome) => nome.split('/').map((x) => x.slice(2)).join('/');
  document.getElementById('sel-epoca').innerHTML = epocas().map((e) => `
    <option value="${esc(e.id)}" ${e.id === ep.id ? 'selected' : ''}>${esc(curto(e.nome))}</option>`).join('');
  document.getElementById('sel-epoca').value = ep.id;
}

// ---------------------------------------------------------------- cabeçalho --
function desenharHead(ep, t, vista) {
  const r = t.resumo || {};
  const pos = posicao(t);
  const compacto = vista === 'jogo';

  const chips = compacto ? '' : `<div class="chips">
    ${chip('Jogos', r.jogos ?? '—')}
    ${chip('V-D', `${r.v ?? 0}-${r.d ?? 0}`)}
    ${pos ? chip('Posição', `${esc(pos)}º`) : ''}
    ${r.media != null ? chip('Marcados', F.num(r.media, 1)) : ''}
    ${r.mediaSofrida != null ? chip('Sofridos', F.num(r.mediaSofrida, 1)) : ''}
  </div>`;

  return `<header class="head">
    <div class="eyebrow">${esc(t.epoca)}${t.projeto ? ' · ' + esc(t.projeto) : ''}</div>
    <h1>${esc(t.nomeCurto)}</h1>
    <p class="comp">${esc(t.competicao)}</p>
    ${chips}
  </header>`;
}

function desenharTabs(ep, t, vista) {
  const atual = vista === 'jogo' ? 'jogos' : vista;
  return `<nav class="tabs" aria-label="Secções do escalão">
    ${TABS.map(([k, nome]) => `<a class="tab ${k === atual ? 'on' : ''}"
      href="${href(ep.id, t.id, k)}" ${k === atual ? 'aria-current="page"' : ''}>${nome}</a>`).join('')}
  </nav>`;
}

// ------------------------------------------------------------------ render --
function render(ep, t, vista, param) {
  if (limpar) {
    try { limpar(); } catch { /* ignorar */ }
    limpar = null;
  }

  const v = VISTAS[vista];
  const root = document.getElementById('conteudo');
  const ctx = { epoca: ep.id, equipa: t.id, vista, param };

  root.innerHTML = `
    ${desenharHead(ep, t, vista)}
    ${desenharTabs(ep, t, vista)}
    <div id="vista">${v.render(t, ctx)}</div>`;

  if (typeof v.mount === 'function') {
    limpar = v.mount(root, t, ctx) || null;
  }

  desenharSidebar(ep, t);
  desenharMobile(ep, t);

  document.title = `${t.nomeCurto} · ${t.competicao} — Farense Basket`;
  window.scrollTo(0, 0);
}

async function rotear() {
  const p = parse();
  let ep = epoca(p.epoca);
  let t = ep ? equipa(ep.id, p.equipa) : null;

  if (!ep) {
    const a = arranque();
    ep = epoca(a.epoca);
  }
  if (!t) t = ep.equipas[0];

  const vista = VISTAS[p.vista] ? p.vista : 'resumo';
  const esperado = href(ep.id, t.id, vista, p.param);
  if (location.hash !== esperado) {
    history.replaceState(null, '', esperado);
  }

  render(ep, t, vista, p.param);
}

// ------------------------------------------------------------------ trocas --
function trocarEpoca(novoId) {
  const atual = parse();
  const t = equipa(atual.epoca, atual.equipa);
  const nova = epoca(novoId);
  if (!nova) return;

  const parecida = t
    ? nova.equipas.find((x) => x.escalao === t.escalao && x.genero === t.genero)
    : null;
  location.hash = href(novoId, (parecida || nova.equipas[0]).id, 'resumo');
}

// ------------------------------------------------------------------- sinais --
async function verificarLive() {
  const ponto = document.getElementById('live-dot');
  const texto = document.getElementById('live-txt');
  try {
    const r = await fetch('/api/live', { cache: 'no-store' });
    const d = await r.json();
    const n = (d.jogos || []).length;
    ponto.hidden = n === 0;
    texto.textContent = n ? `Ao vivo · ${n}` : 'Ao vivo';
    document.getElementById('live-link').classList.toggle('on', n > 0);
  } catch {
    ponto.hidden = true;
    texto.textContent = 'Ao vivo';
  }
}

// -------------------------------------------------------------------- boot --
function ligarShell() {
  document.getElementById('nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-equipa]');
    if (!b) return;
    const p = parse();
    location.hash = href(p.epoca, b.dataset.equipa, 'resumo');
  });

  document.getElementById('season').addEventListener('click', (e) => {
    const b = e.target.closest('[data-epoca]');
    if (b) trocarEpoca(b.dataset.epoca);
  });

  document.getElementById('conteudo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-jogo]');
    if (!b) return;
    const p = parse();
    if (!p.epoca || !p.equipa) return;
    location.hash = href(p.epoca, p.equipa, 'jogo', b.dataset.jogo);
  });

  document.getElementById('sel-equipa').addEventListener('change', (e) => {
    const p = parse();
    location.hash = href(p.epoca, e.target.value, 'resumo');
  });

  document.getElementById('sel-epoca').addEventListener('change', (e) => {
    trocarEpoca(e.target.value);
  });

  document.addEventListener('swish:live', (e) => {
    const ponto = document.getElementById('live-dot');
    const vivo = !!e.detail.vivo;
    ponto.hidden = !vivo;
    document.getElementById('live-link').classList.toggle('on', vivo);
  });

  window.addEventListener('hashchange', rotear);
  window.addEventListener('popstate', rotear);
}

(async function boot() {
  try {
    await carregar();
  } catch (e) {
    document.getElementById('erro-fatal').hidden = false;
    document.getElementById('erro-msg').textContent = e.message;
    document.getElementById('erro-retry').onclick = () => location.reload();
    return;
  }

  ligarShell();
  await rotear();
  verificarLive();
  setInterval(verificarLive, 60000);

})();
