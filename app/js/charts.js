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
