import {
  carregar, dados, epocas, epoca, equipa, arranque, posicao,
} from './data.js';
import * as F from './format.js';
import { esc } from './ui.js';

import resumo from './views/resumo.js';
import jogos from './views/jogos.js';
import jogo from './views/jogo.js';
import classificacao from './views/classificacao.js';
import plantel from './views/plantel.js';
import aovivo from './views/aovivo.js';
import api from './views/api.js';

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
let versao = null;

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

// A zona #/api não tem época nem equipa na rota. Para navegar a partir dela,
// usa a época de arranque e a primeira equipa.
function contexto() {
  const p = parse();
  const ep = epoca(p.epoca) || epoca(arranque().epoca);
  const t = (p.equipa && equipa(ep.id, p.equipa)) || ep.equipas[0];
  return { p, ep, t };
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
  const gerado = g && g.gerado ? F.dataHora(g.gerado) : '';
  const construido = versao && versao.construido ? F.dataHora(versao.construido) : '';
  nota.innerHTML = [
    construido ? `Site: ${esc(construido)}` : '',
    gerado ? `Dados NBN23: ${esc(gerado)}` : '',
  ].filter(Boolean).join('<br>');
  nota.title = 'Site: última publicação desta versão. '
    + 'Dados NBN23: última geração do ficheiro de dados.';
  document.getElementById('live-link').setAttribute('href', href(ep.id, tAtual.id, 'ao-vivo'));
}

// ----------------------------------------------------------------- mobile --
function desenharMobile(ep, t) {
  const { seniores, formacao } = gruposDe(ep);
  const contagem = {};
  for (const x of ep.equipas) contagem[x.nomeCurto] = (contagem[x.nomeCurto] || 0) + 1;
  const item = (x) => {
    const r = x.resumo || {};
    const reg = r.realizados ? `${r.v}-${r.d}` : '—';
    const marca = contagem[x.nomeCurto] > 1 ? ` ${esc(x.variante || '?')}` : '';
    const ativa = x.id === t.id;
    return `<li><button type="button" class="sheet-item ${ativa ? 'on' : ''}" data-equipa="${esc(x.id)}"
      ${ativa ? 'aria-current="true"' : ''}>
      <span class="sheet-nome">${esc(x.nomeCurto)}${marca}<small>${esc(x.competicao)}</small></span>
      <span class="sheet-rec">${esc(reg)}</span>
      <svg class="sheet-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </button></li>`;
  };

  let html = '';
  if (seniores.length) html += `<h3>Séniores</h3><ul>${seniores.map(item).join('')}</ul>`;
  if (formacao.length) html += `<h3>Formação</h3><ul>${formacao.map(item).join('')}</ul>`;

  document.getElementById('sheet-lista').innerHTML = html;
  const nomeAtual = t.nomeCurto + (contagem[t.nomeCurto] > 1 ? ` ${t.variante || ''}` : '');
  document.getElementById('btn-equipa-txt').textContent = nomeAtual;
  // O nome acessível tem de conter o texto visível.
  document.getElementById('btn-equipa').setAttribute('aria-label', `${nomeAtual}, escolher escalão`);

  const curto = (nome) => nome.split('/').map((x) => x.slice(2)).join('/');
  document.getElementById('sel-epoca').innerHTML = epocas().map((e) => `
    <option value="${esc(e.id)}" ${e.id === ep.id ? 'selected' : ''}>${esc(curto(e.nome))}</option>`).join('');
  document.getElementById('sel-epoca').value = ep.id;
}

// ---------------------------------------------------------------- cabeçalho --
// Par marcados/sofridos: o primeiro valor fica em destaque e o segundo mais
// discreto, para se perceber de imediato qual é qual.
function parTopo(marcados, sofridos, dec = 0) {
  if (marcados == null || sofridos == null) return '<span class="mut">—</span>';
  return `<b>${F.num(marcados, dec)}</b><i>/</i><span>${F.num(sofridos, dec)}</span>`;
}

function statTopo(rotulo, valor, nota = '') {
  return `<div class="hstat">
    <span class="k">${esc(rotulo)}</span>
    <span class="v">${valor}</span>
    ${nota ? `<span class="hint">${esc(nota)}</span>` : ''}
  </div>`;
}

function desenharHead(ep, t, vista) {
  const r = t.resumo || {};
  const a = t.agregado || {};
  const pos = posicao(t);
  const compacto = vista === 'jogo';
  const jogos = a.games ?? r.realizados ?? 0;
  const nota = 'marcados / sofridos';

  const stats = compacto ? '' : `<div class="hstats" role="group" aria-label="Resumo da época">
    ${statTopo('Posição', pos ? `${esc(pos)}.º` : '<span class="mut">—</span>')}
    ${statTopo('V-D', `${r.v ?? 0}-${r.d ?? 0}`)}
    ${statTopo('Total', jogos
      ? parTopo(a.points ?? r.pontos, a.pointsConceded ?? r.sofridos)
      : '<span class="mut">—</span>', jogos ? nota : '')}
    ${statTopo('Média', jogos
      ? parTopo(a.pointsAVG ?? r.media, a.pointsConcededAVG ?? r.mediaSofrida, 1)
      : '<span class="mut">—</span>', jogos ? nota : '')}
  </div>`;

  return `<header class="head">
    <div class="eyebrow">${esc(t.epoca)}${t.projeto ? ' · ' + esc(t.projeto) : ''}</div>
    <h1>${esc(t.nomeCurto)}</h1>
    <p class="comp">${esc(t.competicao)}</p>
    ${stats}
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

// Zona da API: não pertence a nenhum escalão, por isso fica fora de VISTAS.
function renderApi() {
  if (limpar) {
    try { limpar(); } catch { /* ignorar */ }
    limpar = null;
  }
  const ep = epoca(arranque().epoca);
  const root = document.getElementById('conteudo');
  root.innerHTML = `<div id="vista" class="vista-enter">${api.render()}</div>`;
  root.removeAttribute('aria-busy');
  limpar = api.mount(root) || null;

  // A barra lateral continua a mostrar as equipas, mas nenhuma fica activa.
  desenharSidebar(ep, ep.equipas[0]);
  document.querySelectorAll('#nav .nav-item.on').forEach((b) => {
    b.classList.remove('on');
    b.removeAttribute('aria-current');
  });
  desenharMobile(ep, ep.equipas[0]);
  document.getElementById('tabbar').innerHTML = '';
  document.title = 'API — Farense Basket';
  window.scrollTo(0, 0);
}

async function rotear() {
  const p = parse();
  document.getElementById('api-link').classList.toggle('on', p.epoca === 'api');
  if (p.epoca === 'api') { renderApi(); return; }
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
// Sheet de escalão (mobile): abre de baixo, fecha ao escolher, tocar fora,
// Esc ou arrastar o puxador para baixo.
function ligarSheet() {
  const sheet = document.getElementById('sheet-equipa');
  const painel = sheet.querySelector('.sheet-painel');
  const fechar = () => sheet.close();

  document.getElementById('btn-equipa').addEventListener('click', () => {
    sheet.showModal();
    const ativo = sheet.querySelector('.sheet-item.on');
    if (ativo) ativo.scrollIntoView({ block: 'center' });
  });

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) { fechar(); return; }
    const b = e.target.closest('[data-equipa]');
    if (!b) return;
    const { ep } = contexto();
    location.hash = href(ep.id, b.dataset.equipa, 'resumo');
    fechar();
  });

  const puxador = sheet.querySelector('.sheet-grip');
  let y0 = null;
  puxador.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    puxador.setPointerCapture(e.pointerId);
    painel.style.transition = 'none';
  });
  puxador.addEventListener('pointermove', (e) => {
    if (y0 === null) return;
    painel.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`;
  });
  const largar = (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    painel.style.transition = '';
    painel.style.transform = '';
    if (dy > 90) fechar();
  };
  puxador.addEventListener('pointerup', largar);
  puxador.addEventListener('pointercancel', largar);
}

// Swipe-back (telemóvel): no detalhe de jogo, arrastar desde a borda esquerda
// para a direita volta à lista de jogos. O conteúdo acompanha o dedo.
function ligarGestos() {
  const raiz = document.getElementById('conteudo');
  const movel = matchMedia('(max-width: 767px)');
  let x0 = null;
  let y0 = 0;
  let dx = 0;

  document.addEventListener('touchstart', (e) => {
    const p = parse();
    const t = e.touches[0];
    x0 = (movel.matches && p.vista === 'jogo' && e.touches.length === 1 && t.clientX <= 28)
      ? t.clientX : null;
    y0 = t.clientY;
    dx = 0;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (x0 === null) return;
    const t = e.touches[0];
    dx = t.clientX - x0;
    if (Math.abs(t.clientY - y0) > Math.abs(dx) && dx < 24) { x0 = null; return; }
    if (dx > 0) {
      raiz.style.transition = 'none';
      raiz.style.transform = `translateX(${dx}px)`;
      raiz.style.opacity = String(Math.max(.4, 1 - dx / 500));
    }
  }, { passive: true });

  const largar = () => {
    if (x0 === null) return;
    x0 = null;
    raiz.style.transition = 'transform .2s ease, opacity .2s ease';
    raiz.style.transform = '';
    raiz.style.opacity = '';
    if (dx > 90) {
      const p = parse();
      location.hash = href(p.epoca, p.equipa, 'jogos');
    }
  };
  document.addEventListener('touchend', largar);
  document.addEventListener('touchcancel', largar);
}

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

    const { p, ep, t } = contexto();
    if (!ep) return;

    if (aguardaG) {
      aguardaG = false;
      clearTimeout(timer);
      const vista = SECCAO_POR_TECLA[e.key];
      if (vista) { e.preventDefault(); location.hash = href(ep.id, t.id, vista); }
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
      const i = ep.equipas.findIndex((x) => x.id === t.id);
      const n = ep.equipas.length;
      const alvo = ep.equipas[(i + (e.key === ']' ? 1 : -1) + n) % n];
      location.hash = href(ep.id, alvo.id, p.vista === 'jogo' ? 'resumo' : p.vista);
    }
  });
}

function ligarMenu() {
  const raiz = document.documentElement;
  const sidebar = document.getElementById('sidebar');
  const fechar = document.getElementById('side-toggle');
  const abrir = document.getElementById('side-reopen');
  if (!sidebar || !fechar || !abrir) return;

  const aplicar = (fechado, focar = false) => {
    if (fechado) raiz.dataset.menu = 'fechado';
    else delete raiz.dataset.menu;

    fechar.setAttribute('aria-expanded', String(!fechado));
    abrir.setAttribute('aria-expanded', String(!fechado));
    if (!fechado) sidebar.removeAttribute('aria-hidden');

    try {
      localStorage.setItem('menu-lateral', fechado ? 'fechado' : 'aberto');
    } catch { /* sem armazenamento */ }

    // Ao fechar, tira o foco de dentro da sidebar antes de a esconder dos
    // leitores de ecrã.
    if (focar) (fechado ? abrir : fechar).focus();
    if (fechado) sidebar.setAttribute('aria-hidden', 'true');
  };

  fechar.addEventListener('click', () => aplicar(true, true));
  abrir.addEventListener('click', () => aplicar(false, true));
  aplicar(raiz.dataset.menu === 'fechado');
}

function ligarShell() {
  ligarMenu();
  ligarAtalhos();
  ligarGestos();

  // Se um logo ou uma cara da API falhar, remove o <img> em vez de deixar o
  // ícone quebrado. Nos avatares ficam as iniciais por baixo.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement
        && (img.classList.contains('tlogo') || img.closest('.pavatar'))) img.remove();
  }, true);
  document.querySelectorAll('[data-tema-toggle]').forEach((b) => b.addEventListener('click', alternarTema));

  document.getElementById('nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-equipa]');
    if (!b) return;
    const { ep } = contexto();
    location.hash = href(ep.id, b.dataset.equipa, 'resumo');
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

  ligarSheet();

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

async function carregarVersao() {
  try {
    const r = await fetch('/versao.json', { cache: 'no-store' });
    if (r.ok) versao = await r.json();
  } catch { /* sem versão: o rodapé mostra só a data dos dados */ }
}

(async function boot() {
  try {
    await Promise.all([carregar(), carregarVersao()]);
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
