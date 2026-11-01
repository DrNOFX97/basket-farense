// Cartão de jogador: foto, número, escalão, números da época e evolução
// jogo a jogo. Abre num <dialog>: sheet de baixo em telemóvel (com puxador para
// arrastar), painel lateral em tablet/desktop. O <dialog> trata do foco preso,
// do Esc e do aria-modal; aqui trata-se de devolver o foco a quem o abriu.

import * as D from './data.js';
import * as F from './format.js';
import * as G from './charts.js';
import { esc, avatar, vazio } from './ui.js';

const METRICAS = [['pts', 'Pontos'], ['val', 'Valorização'], ['min', 'Minutos'], ['ft', 'Faltas']];

let dlg = null;
let gatilho = null;
let estado = { t: null, epoca: null, fid: null, metrica: 'pts' };
let obs = null;

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

// HTML do conteúdo do cartão. Puro (sem DOM), para o teste de fumo.
export function cartaoHTML(t, epocaId, fid, metrica = 'pts') {
  const a = D.statsPlantel(t).find((x) => String(x.fid) === String(fid));
  if (!a) return vazio('Jogador não encontrado', 'Este jogador não consta do plantel.');
  const jogos = D.jogosJogador(t, fid);

  const kpi = (rotulo, valor, sub = '') => `<div class="kpi"><span>${rotulo}</span><b>${valor}</b>${sub ? `<span class="kpi-v">${sub}</span>` : ''}</div>`;
  const kpis = a.j
    ? `<div class="kpis kpis-sm">
        ${kpi('Jogos', a.j)}
        ${kpi('Pontos', a.pts, `${F.num(a.ppg, 1)} por jogo`)}
        ${kpi('Minutos', F.mmss(a.mpg), 'por jogo')}
        ${kpi('Valorização', a.val, `${F.num(a.valpg, 1)} por jogo`)}
        ${kpi('Lances livres', `${a.cll}/${a.tll}`, `${a.cll} convertidos · ${a.fll} falhados`)}
        ${kpi('% lances livres', a.tll ? pct(a.cll, a.tll) : '—')}
        ${kpi('Faltas', a.ft, `${F.num(a.ft / a.j, 1)} por jogo`)}
        ${kpi('2 e 3 pontos', `${a.c2} · ${a.c3}`, 'convertidos')}
      </div>`
    : '<div class="empty"><b>Ainda sem jogos</b>Está inscrito, mas ainda não consta de nenhum boxscore.</div>';

  const serie = G.serieJogador(jogos, metrica);
  const grafico = jogos.length
    ? `<h3 class="jc-h">Jogo a jogo</h3>
       <div class="seg seg-sm" role="group" aria-label="Estatística do gráfico">
         ${METRICAS.map(([k, n]) => `<button type="button" data-jc-metrica="${k}" aria-pressed="${metrica === k}" class="${metrica === k ? 'on' : ''}">${n}</button>`).join('')}
       </div>
       <div class="grafico jc-grafico" data-jc-grafico role="img" aria-label="${esc(G.descreverJogador(serie, METRICAS.find(([k]) => k === metrica)[1]))}"></div>
       <p class="box-leg" style="padding:6px 0 0">Linha tracejada: média de ${F.num(G.mediaSerie(serie), 1)}${metrica === 'min' ? ' minutos' : ''} por jogo.</p>
       <ul class="jc-jogos">${jogos.map((g) => `<li>
         <a href="#/${esc(epocaId)}/${esc(t.id)}/jogo/${esc(g.fid)}" data-jc-fechar>
           <span class="jc-j">${esc(g.rot)}</span>
           <span class="jc-adv">${g.emCasa ? '' : '@ '}${esc(g.adv)}</span>
           <span class="jc-res ${g.resultado === 'V' ? 'v' : g.resultado === 'D' ? 'd' : ''}">${esc(g.resultado || '')}</span>
           <span class="jc-n"><b>${g.pts}</b> pts</span>
           <span class="jc-n">${F.mmss(g.min)}</span>
           <span class="jc-n">VAL ${g.val}</span>
         </a></li>`).join('')}</ul>`
    : '';

  return `<div class="jc-topo">
      ${avatar(a.foto, a.nome, 'pavatar-xl')}
      <div class="jc-id">
        <h2 id="jcard-t">${esc(a.nome)}</h2>
        <p>${a.num ? `<b>#${esc(a.num)}</b> · ` : ''}${esc(t.nomeCurto)} · ${esc(t.competicao)}</p>
      </div>
    </div>
    ${kpis}
    ${grafico}
    <p class="nota" style="margin:14px 0 0">2 e 3 pontos são só convertidos: a fonte não regista falhados de campo.</p>`;
}

function desenharGrafico() {
  const el = dlg && dlg.querySelector('[data-jc-grafico]');
  if (!el) return;
  const w = Math.round(el.clientWidth);
  if (!w) return;
  const jogos = D.jogosJogador(estado.t, estado.fid);
  el.innerHTML = G.barrasJogador(G.serieJogador(jogos, estado.metrica), w);
}

function pintar() {
  const corpo = dlg.querySelector('.jc-corpo');
  corpo.innerHTML = cartaoHTML(estado.t, estado.epoca, estado.fid, estado.metrica);
  desenharGrafico();
}

function criar() {
  if (dlg) return;
  dlg = document.createElement('dialog');
  dlg.className = 'sheet jcard';
  dlg.setAttribute('aria-labelledby', 'jcard-t');
  dlg.innerHTML = `<div class="sheet-painel jcard-painel">
    <div class="sheet-grip" aria-hidden="true"><i></i></div>
    <button type="button" class="jc-fechar" aria-label="Fechar cartão do jogador">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <div class="jc-corpo"></div>
  </div>`;
  document.body.appendChild(dlg);

  const painel = dlg.querySelector('.jcard-painel');
  dlg.querySelector('.jc-fechar').addEventListener('click', () => dlg.close());

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) { dlg.close(); return; }
    const m = e.target.closest('[data-jc-metrica]');
    if (m) { estado.metrica = m.dataset.jcMetrica; pintar(); const n = dlg.querySelector(`[data-jc-metrica="${estado.metrica}"]`); if (n) n.focus(); return; }
    if (e.target.closest('[data-jc-fechar]')) dlg.close();
  });

  dlg.addEventListener('close', () => {
    if (obs) { obs.disconnect(); obs = null; }
    document.body.classList.remove('sem-scroll');
    if (gatilho && document.contains(gatilho)) gatilho.focus({ preventScroll: true });
    gatilho = null;
  });

  // Puxador (telemóvel): arrastar ≥ 90 px para baixo fecha.
  const puxador = dlg.querySelector('.sheet-grip');
  let y0 = null;
  puxador.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    puxador.setPointerCapture(e.pointerId);
    painel.style.transition = 'none';
  });
  puxador.addEventListener('pointermove', (e) => {
    if (y0 !== null) painel.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`;
  });
  const largar = (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    painel.style.transition = '';
    painel.style.transform = '';
    if (dy > 90) dlg.close();
  };
  puxador.addEventListener('pointerup', largar);
  puxador.addEventListener('pointercancel', largar);
}

export function abrir(t, epocaId, fid, origem = null) {
  criar();
  estado = { t, epoca: epocaId, fid: String(fid), metrica: 'pts' };
  gatilho = origem;
  pintar();
  if (!dlg.open) dlg.showModal();
  document.body.classList.add('sem-scroll');
  desenharGrafico();
  if (typeof ResizeObserver !== 'undefined') {
    if (obs) obs.disconnect();
    obs = new ResizeObserver(desenharGrafico);
    obs.observe(dlg.querySelector('.jc-corpo'));
  }
}

// Liga o clique em qualquer [data-jogador] da página. obterContexto devolve
// { ep, t } da vista actual.
export function ligar(obterContexto) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-jogador]');
    if (!b) return;
    e.preventDefault();
    const { ep, t } = obterContexto();
    abrir(t, ep.id, b.dataset.jogador, b);
  });
}
