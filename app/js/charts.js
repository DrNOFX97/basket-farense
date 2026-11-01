// Gráficos em SVG, sem dependências. Recebem os dados e a largura disponível
// e devolvem markup; quem chama injecta-o e volta a chamar quando o espaço muda.

import * as F from './format.js';
import { esc } from './ui.js';

function rotuloJornada(j, i) {
  const m = /(\d+)/.exec(j.jornada || '');
  return `J${m ? m[1] : i + 1}`;
}

// Descrição longa para leitores de ecrã, já que o SVG é decorativo.
export function descreverPontos(jogos) {
  const partes = jogos.map((j, i) => {
    const adv = j.emCasa ? j.fora : j.casa;
    return `${rotuloJornada(j, i)} contra ${adv}: ${j.meus} marcados, ${j.adv} sofridos`;
  });
  return `Pontos marcados e sofridos por jogo ao longo das jornadas. ${partes.join('; ')}.`;
}

// Duas linhas jogo a jogo: dourada com os pontos marcados, vermelha com os
// sofridos. O eixo Y usa o maior dos dois valores.
export function linhaPontos(jogos, largura) {
  if (!jogos.length) return '';
  const compacto = largura < 560;
  const H = compacto ? 190 : 230;
  const M = { top: 12, right: 12, bottom: 26, left: compacto ? 30 : 38 };
  const W = Math.max(260, Math.round(largura));
  const plotW = W - M.left - M.right;
  const base = H - M.bottom;
  const plotH = base - M.top;

  const marcados = jogos.map((j) => Number(j.meus) || 0);
  const sofridos = jogos.map((j) => Number(j.adv) || 0);
  const max = Math.max(1, ...marcados, ...sofridos);
  const passo = max <= 40 ? 10 : max <= 100 ? 20 : 25;
  const topo = Math.max(passo, Math.ceil((max + 1) / passo) * passo);

  // Centros de "faixa": com poucos jogos os pontos não ficam colados às bordas.
  const px = (i) => M.left + ((i + 0.5) / jogos.length) * plotW;
  const py = (v) => base - (v / topo) * plotH;

  const ticks = [];
  for (let v = 0; v <= topo; v += passo) ticks.push(v);

  const grade = ticks.map((v) => `<line class="g-grade${v === 0 ? ' zero' : ''}"
    x1="${M.left}" y1="${py(v)}" x2="${W - M.right}" y2="${py(v)}"/>`).join('');
  const eixoY = ticks.map((v) => `<text class="g-eixo" x="${M.left - 7}" y="${py(v)}"
    text-anchor="end" dominant-baseline="middle">${v}</text>`).join('');

  const caminho = (valores) => valores
    .map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
    .join(' ');
  const linhaMarcados = `<path class="g-linha m" d="${caminho(marcados)}"/>`;
  const linhaSofridos = `<path class="g-linha s" d="${caminho(sofridos)}"/>`;

  const mostraValores = jogos.length <= 6 && plotW / jogos.length >= 52;
  const marcas = jogos.map((j, i) => {
    const x = px(i);
    const ym = py(marcados[i]);
    const ys = py(sofridos[i]);
    const adv = j.emCasa ? j.fora : j.casa;
    const baseTitulo = `${rotuloJornada(j, i)} · ${F.dataCurta(j.data)} · ${adv}`;
    const tituloM = `${baseTitulo} · ${j.meus} marcados`;
    const tituloS = `${baseTitulo} · ${j.adv} sofridos`;

    // O valor de cada linha fica do lado oposto ao da outra linha, para os
    // dois números não se sobreporem quando os resultados são próximos.
    let valores = '';
    if (mostraValores) {
      const marcadosAcima = ym <= ys;
      const yM = marcadosAcima ? Math.max(11, ym - 11) : Math.min(base - 4, ym + 15);
      const yS = marcadosAcima ? Math.min(base - 4, ys + 15) : Math.max(11, ys - 11);
      valores = `
        <text class="g-valor" x="${x.toFixed(1)}" y="${yM.toFixed(1)}" text-anchor="middle">${j.meus}</text>
        <text class="g-valor" x="${x.toFixed(1)}" y="${yS.toFixed(1)}" text-anchor="middle">${j.adv}</text>`;
    }

    return `<g>
      <title>${esc(tituloS)}</title>
      <circle class="g-ponto s" cx="${x.toFixed(1)}" cy="${ys.toFixed(1)}" r="4"/>
    </g>
    <g>
      <title>${esc(tituloM)}</title>
      <circle class="g-ponto m" cx="${x.toFixed(1)}" cy="${ym.toFixed(1)}" r="4"/>
    </g>${valores}`;
  }).join('');

  // Etiquetas do eixo X, com espaço suficiente entre si.
  const maxEtiquetas = Math.max(3, Math.floor(plotW / (compacto ? 42 : 52)));
  const salto = Math.max(1, Math.ceil(jogos.length / maxEtiquetas));
  const escolhidas = [];
  for (let i = 0; i < jogos.length; i += 1) {
    const ultima = i === jogos.length - 1;
    if (!ultima && i % salto !== 0) continue;
    const x = px(i);
    const anterior = escolhidas[escolhidas.length - 1];
    if (anterior && x - anterior.x < 30) {
      if (ultima) escolhidas.pop();
      else continue;
    }
    escolhidas.push({ i, x });
  }
  const eixoX = escolhidas.map(({ i, x }) => `<text class="g-eixo" x="${x.toFixed(1)}"
    y="${H - 8}" text-anchor="middle">${rotuloJornada(jogos[i], i)}</text>`).join('');

  return `<svg class="g-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    role="presentation" focusable="false" aria-hidden="true">
    ${grade}
    ${eixoY}
    ${linhaSofridos}
    ${linhaMarcados}
    ${marcas}
    ${eixoX}
  </svg>`;
}

// ---------------------------------------------------------------- evolução ----
const PERIODO_MS = 600000;
const PROLONG_MS = 300000;

function inicioPeriodo(p) {
  return p <= 4 ? (p - 1) * PERIODO_MS : 4 * PERIODO_MS + (p - 5) * PROLONG_MS;
}

// Diferença de pontos (Farense menos adversário) a cada cesto, ao longo do jogo.
export function pontosEvolucao(j) {
  const meu = String(j.emCasa ? j.casaFid : j.foraFid);
  const pts = [{ t: 0, d: 0, per: 1, tempo: 0, nos: 0, eles: 0 }];
  let nos = 0;
  let eles = 0;
  for (const a of j.accoes || []) {
    const [per, tempo, , , code, , val, ok, eq] = a;
    if (code !== 'POINTS' || !ok) continue;
    if (String(eq) === meu) nos += val || 0;
    else eles += val || 0;
    pts.push({ t: inicioPeriodo(per) + (tempo || 0), d: nos - eles, per, tempo, nos, eles });
  }
  const fim = inicioPeriodo((j.parciais || []).length + 1);
  return { pts, fim: Math.max(fim, pts[pts.length - 1].t) };
}

export function descreverEvolucao(j) {
  const { pts } = pontosEvolucao(j);
  const ds = pts.map((p) => p.d);
  const max = Math.max(...ds);
  const min = Math.min(...ds);
  return `Diferença de pontos do Farense ao longo do jogo. Melhor momento: ${max > 0 ? '+' + max : max}; pior momento: ${min}; final: ${ds[ds.length - 1] > 0 ? '+' : ''}${ds[ds.length - 1]}.`;
}

export function linhaEvolucao(j, largura) {
  const { pts, fim } = pontosEvolucao(j);
  if (pts.length < 2) return '';
  const compacto = largura < 560;
  const H = compacto ? 190 : 230;
  const M = { top: 14, right: 12, bottom: 26, left: compacto ? 30 : 38 };
  const W = Math.max(260, Math.round(largura));
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  // Eixo ajustado ao intervalo real (sempre com o zero), sem simetria forçada.
  const dmax = Math.max(0, ...pts.map((p) => p.d));
  const dmin = Math.min(0, ...pts.map((p) => p.d));
  const amp = Math.max(5, dmax - dmin);
  const passo = amp <= 10 ? 5 : amp <= 30 ? 10 : 20;
  const hi = Math.max(passo, Math.ceil(dmax / passo) * passo * (dmax > 0 ? 1 : 0)) || passo;
  const lo = Math.min(-passo, Math.floor(dmin / passo) * passo * (dmin < 0 ? 1 : 0)) || -passo;
  const px = (t) => M.left + (t / fim) * plotW;
  const py = (d) => M.top + ((hi - d) / (hi - lo)) * plotH;
  const y0 = py(0);

  const ticks = [];
  for (let v = lo; v <= hi; v += passo) ticks.push(v);
  const grade = ticks.map((v) => `<line class="g-grade${v === 0 ? ' zero' : ''}"
    x1="${M.left}" y1="${py(v).toFixed(1)}" x2="${W - M.right}" y2="${py(v).toFixed(1)}"/>`).join('');
  const eixoY = ticks.map((v) => `<text class="g-eixo" x="${M.left - 7}" y="${py(v).toFixed(1)}"
    text-anchor="end" dominant-baseline="middle">${v > 0 ? '+' + v : v}</text>`).join('');

  // Fronteiras e nomes dos períodos.
  const nPer = Math.max(4, (j.parciais || []).length);
  let eixoX = '';
  for (let p = 1; p <= nPer; p += 1) {
    const ini = inicioPeriodo(p);
    const f = Math.min(inicioPeriodo(p + 1), fim);
    if (p > 1) {
      eixoX += `<line class="g-grade" x1="${px(ini).toFixed(1)}" y1="${M.top}" x2="${px(ini).toFixed(1)}" y2="${H - M.bottom}"/>`;
    }
    eixoX += `<text class="g-eixo" x="${((px(ini) + px(f)) / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${p <= 4 ? 'P' + p : 'Prol.'}</text>`;
  }

  // Degraus: o valor mantém-se até ao cesto seguinte.
  const pontosPath = [];
  pts.forEach((p, i) => {
    if (i) pontosPath.push([px(p.t), py(pts[i - 1].d)]);
    pontosPath.push([px(p.t), py(p.d)]);
  });
  pontosPath.push([px(fim), py(pts[pts.length - 1].d)]);
  const linha = pontosPath.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${linha} L${px(fim).toFixed(1)} ${y0.toFixed(1)} L${px(0).toFixed(1)} ${y0.toFixed(1)} Z`;

  const marcas = pts.slice(1).map((p) => `<g><title>${esc(
    `P${p.per} ${F.relogio(p.tempo)} · Farense ${p.nos}–${p.eles} · ${p.d > 0 ? '+' : ''}${p.d}`,
  )}</title><circle class="g-ponto m" cx="${px(p.t).toFixed(1)}" cy="${py(p.d).toFixed(1)}" r="2.6"/></g>`).join('');

  return `<svg class="g-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    role="presentation" focusable="false" aria-hidden="true">
    ${grade}
    ${eixoY}
    ${eixoX}
    <clipPath id="ev-cima"><rect x="${M.left}" y="${M.top}" width="${plotW}" height="${(y0 - M.top).toFixed(1)}"/></clipPath>
    <clipPath id="ev-baixo"><rect x="${M.left}" y="${y0.toFixed(1)}" width="${plotW}" height="${(H - M.bottom - y0).toFixed(1)}"/></clipPath>
    <path class="g-area m" d="${area}" clip-path="url(#ev-cima)"/>
    <path class="g-area s" d="${area}" clip-path="url(#ev-baixo)"/>
    <path class="g-linha m" d="${linha}"/>
    ${marcas}
  </svg>`;
}
