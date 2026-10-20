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

// Ícones da barra de separadores (mobile), 24×24, traço.
const ICONES = {
  resumo: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  jogos: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  classificacao: '<path d="M4 20V11M12 20V4M20 20v-6"/>',
  plantel: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.4c2.1.7 3.5 2.6 3.5 5.6"/>',
  'ao-vivo': '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>',
};

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

  // Com uma só época o seletor não tem utilidade: esconde-o.
  const varias = epocas().length > 1;
  document.getElementById('season').hidden = !varias;
  document.getElementById('sel-epoca').hidden = !varias;

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

// Barra inferior (só visível em mobile): os mesmos destinos dos separadores.
function desenharTabBar(ep, t, vista) {
  const atual = vista === 'jogo' ? 'jogos' : vista;
  document.getElementById('tabbar').innerHTML = TABS.map(([k, nome]) => `
    <a class="tb ${k === atual ? 'on' : ''}" href="${esc(href(ep.id, t.id, k))}"
      ${k === atual ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[k]}</svg>
      <span>${nome === 'Classificação' ? 'Tabela' : nome}</span>
    </a>`).join('');
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

  root.removeAttribute('aria-busy');
  // Reinicia a animação de entrada a cada troca de vista.
  const vistaEl = document.getElementById('vista');
  vistaEl.classList.remove('vista-enter');
  void vistaEl.offsetWidth;
  vistaEl.classList.add('vista-enter');

  if (typeof v.mount === 'function') {
    limpar = v.mount(root, t, ctx) || null;
  }

  desenharSidebar(ep, t);
  desenharMobile(ep, t);
  desenharTabBar(ep, t, vista);

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
// Alterna claro/escuro. Parte do que o sistema usa agora e guarda a escolha.
function alternarTema() {
  const raiz = document.documentElement;
  const atual = raiz.dataset.theme
    || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const novo = atual === 'light' ? 'dark' : 'light';
  raiz.dataset.theme = novo;
  try { localStorage.setItem('tema', novo); } catch { /* sem armazenamento */ }
}

// Atalhos de teclado (desktop). `g` abre um "acorde": g + letra muda de secção.
const SECCAO_POR_TECLA = { r: 'resumo', j: 'jogos', c: 'classificacao', p: 'plantel', l: 'ao-vivo' };

function ligarAtalhos() {
  const ajuda = document.getElementById('ajuda');
  const abrirAjuda = () => { if (!ajuda.open) ajuda.showModal(); };
  document.querySelectorAll('[data-ajuda]').forEach((b) => b.addEventListener('click', abrirAjuda));

  let aguardaG = false;
  let timer = null;

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || ajuda.open) return;
    if (e.target.closest('input, select, textarea, [contenteditable]')) return;

    const p = parse();
    const ep = epoca(p.epoca);
    if (!ep) return;

    if (aguardaG) {
      aguardaG = false;
      clearTimeout(timer);
      const vista = SECCAO_POR_TECLA[e.key];
      if (vista) { e.preventDefault(); location.hash = href(ep.id, p.equipa, vista); }
      return;
    }

    if (e.key === 'g') {
      aguardaG = true;
      timer = setTimeout(() => { aguardaG = false; }, 1200);
    } else if (e.key === '?') {
      e.preventDefault();
      abrirAjuda();
    } else if (e.key === 't') {
      alternarTema();
    } else if (e.key === '[' || e.key === ']') {
      const i = ep.equipas.findIndex((x) => x.id === p.equipa);
      const n = ep.equipas.length;
      const alvo = ep.equipas[(i + (e.key === ']' ? 1 : -1) + n) % n];
      location.hash = href(ep.id, alvo.id, p.vista === 'jogo' ? 'resumo' : p.vista);
    }
  });
}

function ligarShell() {
  ligarAtalhos();
  document.querySelectorAll('[data-tema-toggle]').forEach((b) => b.addEventListener('click', alternarTema));

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
    document.getElementById('conteudo').innerHTML = '';
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
