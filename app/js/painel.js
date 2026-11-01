// Painel de análise de um jogo, ao estilo da Swish: três separadores
// (Comparação, Fluxo do jogo, Líderes) e um filtro de período que se aplica a
// tudo o que se calcula a partir das ações. Usado no detalhe de jogo e no Ao vivo.
//
// O estado (separador e período) vive aqui, não na vista, para sobreviver aos
// redesenhos de 5 em 5 segundos do Ao vivo.

import * as A from './analise.js';
import * as G from './charts.js';
import * as F from './format.js';
import { esc, avatar, linhaCmp } from './ui.js';

const estado = { aba: 'comp', per: 'todos' };

// Só para testes: escolhe o separador e o período sem passar pelo DOM.
export function definirEstado(aba, per) { estado.aba = aba; estado.per = per; }

export const ABAS = [['comp', 'Comparação'], ['fluxo', 'Fluxo do jogo'], ['lid', 'Líderes']];

const GRAFICOS = {
  fluxo: [(j, w, per) => G.linhaFluxo(j, w, per), (j, per) => G.descreverFluxo(j, per)],
  parciais: [(j, w) => G.barrasParciais(j, w), (j) => G.descreverParciais(j)],
  lideranca: [(j, w) => G.barrasLideranca(j, w), (j) => G.descreverLideranca(j)],
};

// Contentor de gráfico: o SVG só se desenha depois de medir a largura.
export function contentorGrafico(tipo, j, per = 'todos') {
  return `<div class="grafico" data-grafico="${tipo}" data-fid="${esc(j.fid)}" data-per="${esc(per)}" role="img"></div>`;
}

const nomeAdv = (j) => (j.emCasa ? j.fora : j.casa);
const legendaSeries = (j) => `<div class="legenda-graf">
  <span><i class="sw a"></i>SC Farense</span>
  <span><i class="sw b"></i>${esc(nomeAdv(j))}</span>
</div>`;

export { legendaSeries };

function perAtual(j) {
  const pers = A.periodosDe(j);
  return estado.per !== 'todos' && pers.includes(estado.per) ? estado.per : 'todos';
}

function ladoNos(j, tot) {
  return j.emCasa ? { nos: tot.casa, eles: tot.fora } : { nos: tot.fora, eles: tot.casa };
}

// ----------------------------------------------------------------- comparação
function comparacao(j, per) {
  const { nos, eles } = ladoNos(j, A.totais(j, per));
  if (!nos.pts && !eles.pts && !nos.ft && !eles.ft) {
    return '<div class="empty">Sem ações neste período.</div>';
  }
  const comp = (t) => `${t.pts} = ${t.ll} + 2×${t.c2} + 3×${t.c3}`;
  const tec = nos.tecnicas || eles.tecnicas
    ? `<p class="box-leg">Faltas técnicas do banco ou do treinador (não entram nas faltas dos jogadores): Farense ${nos.tecnicas} · ${esc(nomeAdv(j))} ${eles.tecnicas}.</p>`
    : '';
  return `<div class="card-b"><div class="cmp">
      ${linhaCmp('Lances livres (convertidos/tentados)', nos.ll, eles.ll, (x) => x,
        { txtA: `${nos.ll}/${nos.ll + nos.llf}`, txtB: `${eles.ll}/${eles.ll + eles.llf}` })}
      ${linhaCmp('2 pontos (convertidos)', nos.c2, eles.c2)}
      ${linhaCmp('3 pontos (convertidos)', nos.c3, eles.c3)}
      ${linhaCmp('Faltas (menos é melhor)', nos.ft, eles.ft, (x) => x, { menosMelhor: true })}
    </div>
    ${legendaSeries(j)}
    <p class="box-leg" style="padding:10px 0 0">Pontos = lances livres + 2×(2 pontos) + 3×(3 pontos):
      Farense <b>${comp(nos)}</b> · ${esc(nomeAdv(j))} <b>${comp(eles)}</b>.</p>
    ${tec}
    <p class="box-leg">2 e 3 pontos são lançamentos convertidos: a fonte não regista falhados de campo, por isso não há percentagem de lançamento.</p></div>`;
}

// ---------------------------------------------------------------------- fluxo
function textoRacha(r) {
  const quem = r.nos ? 'Farense' : 'Adversário';
  const quando = r.ini.per === r.fim.per
    ? `${A.nomePeriodo(r.ini.per)}, ${F.relogioMs(r.ini.tempo)} → ${F.relogioMs(r.fim.tempo)}`
    : `${A.nomePeriodo(r.ini.per)} ${F.relogioMs(r.ini.tempo)} → ${A.nomePeriodo(r.fim.per)} ${F.relogioMs(r.fim.tempo)}`;
  return `<li><b class="${r.nos ? 'tag-m' : 'tag-s'}">${r.pts}-0</b> ${quem} <span>${quando}</span></li>`;
}

function fluxoPainel(j, per) {
  const f = A.fluxo(j, per);
  if (f.pts.length < 2) return '<div class="empty">Sem cestos neste período.</div>';
  // Para o jogo inteiro usa os valores que a API calcula, para coincidirem com o placar.
  const l = j.lideranca;
  const api = per === 'todos' && l;
  const maiorNos = api ? (j.emCasa ? l.maiorCasa : l.maiorFora) ?? 0 : f.maiorNos;
  const maiorEles = api ? (j.emCasa ? l.maiorFora : l.maiorCasa) ?? 0 : f.maiorEles;
  const empates = api ? l.empates ?? 0 : f.empates;
  const trocas = api ? l.trocas ?? 0 : f.trocas.length;
  const rachas = [...f.rachas].sort((a, b) => b.pts - a.pts);
  return `<div class="card-b chart-b">
    ${contentorGrafico('fluxo', j, per)}
    <p class="box-leg" style="padding:6px 0 0">Diferença de pontos do Farense a cada cesto: acima de zero o Farense está a ganhar${per === 'todos' ? '' : ' (conta só este período)'}.
      Faixas = rachas de ${A.RACHA_MIN} ou mais pontos seguidos; círculos = trocas de liderança.</p>
    <div class="kpis kpis-sm kpis-4" style="margin-top:12px">
      <div class="kpi"><span>Maior vantagem</span><b>Farense ${maiorNos}</b><span class="kpi-v">${esc(nomeAdv(j))} ${maiorEles}</span></div>
      <div class="kpi"><span>Trocas de liderança</span><b>${trocas}</b></div>
      <div class="kpi"><span>Empates</span><b>${empates}</b></div>
      <div class="kpi"><span>Rachas</span><b>${rachas.length}</b><span class="kpi-v">${A.RACHA_MIN}+ pontos sem resposta</span></div>
    </div>
    ${rachas.length ? `<ul class="rachas">${rachas.map(textoRacha).join('')}</ul>` : ''}
  </div>`;
}

// -------------------------------------------------------------------- líderes
const METRICAS = [
  ['pts', 'Pontos', true, (v) => `${v}`],
  ['val', 'Valorização', false, (v) => `${v}`],
  ['pm', '+/−', false, (v) => (v > 0 ? `+${v}` : `${v}`)],
  ['ft', 'Faltas', true, (v) => `${v}`],
  ['min', 'Minutos', false, (v) => F.mmss(v)],
];

function celulaLider(p, fmt) {
  if (!p) return '<div class="lid-c vazio">—</div>';
  const mais = p.empatados ? ` <small title="Empatado com mais ${p.empatados}">+${p.empatados}</small>` : '';
  return `<div class="lid-c">${avatar(p.foto, p.nome, 'pavatar-sm')}<span class="lid-n">${esc(p.nome)}${mais}</span><b>${fmt(p.valor)}</b></div>`;
}

function lideresPainel(j, per) {
  const L = A.lideres(j, per);
  const { nos, eles } = ladoNos(j, L);
  const linhas = METRICAS.map(([k, rotulo, porPer, fmt]) => {
    const jogoInteiro = per !== 'todos' && !porPer;
    return `<div class="lid-k">${rotulo}${jogoInteiro ? ' <small>(jogo inteiro)</small>' : ''}</div>
      ${celulaLider(nos[k], fmt)}${celulaLider(eles[k], fmt)}`;
  }).join('');
  return `<div class="card-b">
    <div class="lid">
      <div class="lid-t">SC Farense</div><div class="lid-t">${esc(nomeAdv(j))}</div>
      ${linhas}
    </div>
    ${per === 'todos' ? '' : '<p class="box-leg">Pontos e faltas seguem o período escolhido. Valorização, +/− e minutos só existem para o jogo inteiro.</p>'}
  </div>`;
}

// ----------------------------------------------------------------------- HTML
export function painelHTML(j) {
  const per = perAtual(j);
  const pers = A.periodosDe(j);
  const corpo = estado.aba === 'fluxo' ? fluxoPainel(j, per)
    : estado.aba === 'lid' ? lideresPainel(j, per) : comparacao(j, per);
  const id = `an-${j.fid}`;
  return `<section class="card analise" data-analise="${esc(j.fid)}">
    <div class="card-h an-barra">
      <div class="seg seg-sm" role="tablist" aria-label="Análise do jogo">
        ${ABAS.map(([k, n]) => `<button type="button" role="tab" id="${id}-${k}" data-an-aba="${k}"
          aria-selected="${estado.aba === k}" aria-controls="${id}-p" tabindex="${estado.aba === k ? 0 : -1}"
          class="${estado.aba === k ? 'on' : ''}">${n}</button>`).join('')}
      </div>
      <div class="seg seg-sm" role="group" aria-label="Período">
        <button type="button" data-an-per="todos" aria-pressed="${per === 'todos'}" class="${per === 'todos' ? 'on' : ''}">Todos</button>
        ${pers.map((p) => `<button type="button" data-an-per="${p}" aria-pressed="${per === p}"
          class="${per === p ? 'on' : ''}">${A.nomePeriodo(p)}</button>`).join('')}
      </div>
    </div>
    <div role="tabpanel" id="${id}-p" aria-labelledby="${id}-${estado.aba}">${corpo}</div>
  </section>`;
}

// ------------------------------------------------------------------- desenho
// Desenha os SVG com a largura actual de cada contentor.
export function pintar(raiz, jogos) {
  raiz.querySelectorAll('[data-grafico]').forEach((el) => {
    const j = jogos.find((x) => String(x.fid) === el.dataset.fid);
    const w = Math.round(el.clientWidth);
    const g = GRAFICOS[el.dataset.grafico];
    if (!j || !w || !g) return;
    const per = el.dataset.per === 'todos' ? 'todos' : Number(el.dataset.per);
    el.innerHTML = g[0](j, w, per);
    el.setAttribute('aria-label', g[1](j, per));
  });
}

// Chave do botão com foco, para o repor depois de redesenhar.
export function guardarFoco(raiz) {
  const a = document.activeElement;
  if (!a || !raiz.contains(a)) return () => {};
  const sel = a.dataset.anAba ? `[data-an-aba="${a.dataset.anAba}"]`
    : a.dataset.anPer ? `[data-an-per="${a.dataset.anPer}"]` : null;
  return () => { if (sel) { const n = raiz.querySelector(sel); if (n) n.focus({ preventScroll: true }); } };
}

function refrescar(raiz, obterJogos) {
  const jogos = obterJogos();
  const repor = guardarFoco(raiz);
  raiz.querySelectorAll('[data-analise]').forEach((sec) => {
    const j = jogos.find((x) => String(x.fid) === sec.dataset.analise);
    if (j) sec.outerHTML = painelHTML(j);
  });
  pintar(raiz, jogos);
  repor();
}

// Liga cliques, setas e redimensionamento. Devolve a função de limpeza.
export function montar(raiz, obterJogos) {
  const onClick = (e) => {
    const b = e.target.closest('[data-an-aba],[data-an-per]');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.anAba) estado.aba = b.dataset.anAba;
    else estado.per = b.dataset.anPer === 'todos' ? 'todos' : Number(b.dataset.anPer);
    refrescar(raiz, obterJogos);
  };
  const onKey = (e) => {
    const b = e.target.closest('[data-an-aba]');
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!b || !d) return;
    const ks = ABAS.map(([k]) => k);
    estado.aba = ks[(ks.indexOf(b.dataset.anAba) + d + ks.length) % ks.length];
    refrescar(raiz, obterJogos);
    const n = raiz.querySelector(`[data-an-aba="${estado.aba}"]`);
    if (n) n.focus();
  };
  raiz.addEventListener('click', onClick);
  raiz.addEventListener('keydown', onKey);

  let largura = 0;
  const redesenhar = () => {
    const w = Math.round(raiz.clientWidth);
    if (w && w !== largura) { largura = w; pintar(raiz, obterJogos()); }
  };
  const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redesenhar) : null;
  if (obs) obs.observe(raiz);
  else window.addEventListener('resize', redesenhar);
  pintar(raiz, obterJogos());
  largura = Math.round(raiz.clientWidth);

  return () => {
    raiz.removeEventListener('click', onClick);
    raiz.removeEventListener('keydown', onKey);
    if (obs) obs.disconnect(); else window.removeEventListener('resize', redesenhar);
  };
}
