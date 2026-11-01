// Gráficos em SVG, sem dependências. Recebem os dados e a largura disponível
// e devolvem markup; quem chama injecta-o e volta a chamar quando o espaço muda.

import * as F from './format.js';
import { esc } from './ui.js';
import { fluxo, inicioPeriodo, duracaoPeriodo, nomePeriodo, periodosDe, instanteAgora } from './analise.js';

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

// ------------------------------------------------------------------- fluxo ----
const sinal = (d) => (d > 0 ? `+${d}` : String(d));

export function descreverFluxo(j, per = 'todos') {
  const f = fluxo(j, per);
  const ds = f.pts.map((p) => p.d);
  const atual = ds[ds.length - 1];
  const rachas = f.rachas.map((r) => `${r.nos ? 'Farense' : 'adversário'} ${r.pts}-0`).join(', ');
  return `Diferença de pontos do Farense${per === 'todos' ? ' ao longo do jogo' : ` no ${nomePeriodo(per)}`}. `
    + `Melhor momento: ${sinal(Math.max(...ds))}; pior: ${sinal(Math.min(...ds))}; atual: ${sinal(atual)}. `
    + `${f.trocas.length} trocas de liderança. ${f.rachas.length ? `Rachas: ${rachas}.` : 'Sem rachas de 6 ou mais pontos.'}`;
}

export function linhaFluxo(j, largura, per = 'todos') {
  const f = fluxo(j, per);
  if (f.pts.length < 2) return '';
  const nPer = periodosDe(j).length;
  const t0 = per === 'todos' ? 0 : inicioPeriodo(per);
  const fim = per === 'todos' ? inicioPeriodo(Math.max(4, nPer) + 1) : t0 + duracaoPeriodo(per);
  const agora = Math.max(f.pts[f.pts.length - 1].t, Math.min(fim, instanteAgora(j)));
  const vivo = agora < fim;

  const compacto = largura < 560;
  const H = compacto ? 200 : 240;
  const M = { top: 18, right: 12, bottom: 26, left: compacto ? 32 : 40 };
  const W = Math.max(260, Math.round(largura));
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  // Eixo ajustado ao intervalo real (sempre com o zero).
  const dmax = Math.max(0, ...f.pts.map((p) => p.d));
  const dmin = Math.min(0, ...f.pts.map((p) => p.d));
  const amp = Math.max(5, dmax - dmin);
  const passo = amp <= 10 ? 5 : amp <= 30 ? 10 : 20;
  const hi = Math.max(passo, Math.ceil(dmax / passo) * passo);
  const lo = Math.min(-passo, Math.floor(dmin / passo) * passo);
  const px = (t) => M.left + ((t - t0) / (fim - t0)) * plotW;
  const py = (d) => M.top + ((hi - d) / (hi - lo)) * plotH;
  const y0 = py(0);

  const ticks = [];
  for (let v = lo; v <= hi; v += passo) ticks.push(v);
  const grade = ticks.map((v) => `<line class="g-grade${v === 0 ? ' zero' : ''}"
    x1="${M.left}" y1="${py(v).toFixed(1)}" x2="${W - M.right}" y2="${py(v).toFixed(1)}"/>`).join('');
  const eixoY = ticks.map((v) => `<text class="g-eixo" x="${M.left - 7}" y="${py(v).toFixed(1)}"
    text-anchor="end" dominant-baseline="middle">${sinal(v)}</text>`).join('');

  // Eixo X: períodos (jogo inteiro) ou minutos (um período).
  let eixoX = '';
  if (per === 'todos') {
    for (let p = 1; p <= Math.max(4, nPer); p += 1) {
      const ini = inicioPeriodo(p);
      if (p > 1) eixoX += `<line class="g-grade" x1="${px(ini).toFixed(1)}" y1="${M.top}" x2="${px(ini).toFixed(1)}" y2="${H - M.bottom}"/>`;
      eixoX += `<text class="g-eixo" x="${((px(ini) + px(inicioPeriodo(p + 1))) / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${nomePeriodo(p)}</text>`;
    }
  } else {
    const min = duracaoPeriodo(per) / 60000;
    for (let m = 0; m <= min; m += min > 5 ? 2 : 1) {
      const x = px(t0 + m * 60000);
      if (m > 0 && m < min) eixoX += `<line class="g-grade" x1="${x.toFixed(1)}" y1="${M.top}" x2="${x.toFixed(1)}" y2="${H - M.bottom}"/>`;
      const ancora = m === 0 ? 'start' : m === min ? 'end' : 'middle';
      eixoX += `<text class="g-eixo" x="${x.toFixed(1)}" y="${H - 8}" text-anchor="${ancora}">${m} min</text>`;
    }
  }

  // Rachas: faixa por trás da linha, com o resultado da racha por cima.
  const rachas = f.rachas.map((r) => {
    const x1 = px(r.t0);
    const x2 = Math.max(px(r.t1), x1 + 3);
    const cls = r.nos ? 'm' : 's';
    const rotulo = x2 - x1 >= 26
      ? `<text class="g-racha-t ${cls}" x="${((x1 + x2) / 2).toFixed(1)}" y="${r.nos ? M.top + 11 : H - M.bottom - 5}" text-anchor="middle">${r.pts}-0</text>`
      : '';
    const tit = `Racha de ${r.pts}-0 do ${r.nos ? 'Farense' : 'adversário'} (${nomePeriodo(r.ini.per)} ${F.relogioMs(r.ini.tempo)} a ${F.relogioMs(r.fim.tempo)})`;
    return `<g><title>${esc(tit)}</title>
      <rect class="g-racha ${cls}" x="${x1.toFixed(1)}" y="${M.top}" width="${(x2 - x1).toFixed(1)}" height="${plotH}"/>${rotulo}</g>`;
  }).join('');

  // Degraus: o valor mantém-se até ao cesto seguinte.
  const caminho = [];
  f.pts.forEach((p, i) => {
    if (i) caminho.push([px(p.t), py(f.pts[i - 1].d)]);
    caminho.push([px(p.t), py(p.d)]);
  });
  const ultimo = f.pts[f.pts.length - 1];
  caminho.push([px(agora), py(ultimo.d)]);
  const linha = caminho.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${linha} L${px(agora).toFixed(1)} ${y0.toFixed(1)} L${px(f.pts[0].t).toFixed(1)} ${y0.toFixed(1)} Z`;

  const hits = f.pts.slice(1).map((p) => `<g><title>${esc(
    `${nomePeriodo(p.per)} ${F.relogioMs(p.tempo)} · Farense ${p.nos}–${p.eles} · ${sinal(p.d)}`,
  )}</title><circle class="g-hit" cx="${px(p.t).toFixed(1)}" cy="${py(p.d).toFixed(1)}" r="6"/></g>`).join('');

  const trocas = f.trocas.map((tr) => {
    const p = f.pts[tr.idx];
    const tit = `Troca de liderança: ${tr.para === 'nos' ? 'Farense passa a liderar' : 'adversário passa a liderar'} (${nomePeriodo(p.per)} ${F.relogioMs(p.tempo)})`;
    return `<g><title>${esc(tit)}</title>
      <circle class="g-troca ${tr.para === 'nos' ? 'm' : 's'}" cx="${px(p.t).toFixed(1)}" cy="${py(p.d).toFixed(1)}" r="4.5"/></g>`;
  }).join('');

  const agoraMarca = vivo
    ? `<circle class="g-agora" cx="${px(agora).toFixed(1)}" cy="${py(ultimo.d).toFixed(1)}" r="4.5"/>`
    : '';

  return `<svg class="g-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    role="presentation" focusable="false" aria-hidden="true">
    ${grade}
    ${eixoY}
    ${eixoX}
    ${rachas}
    <clipPath id="fl-cima"><rect x="${M.left}" y="${M.top}" width="${plotW}" height="${Math.max(0, y0 - M.top).toFixed(1)}"/></clipPath>
    <clipPath id="fl-baixo"><rect x="${M.left}" y="${y0.toFixed(1)}" width="${plotW}" height="${Math.max(0, H - M.bottom - y0).toFixed(1)}"/></clipPath>
    <path class="g-area m" d="${area}" clip-path="url(#fl-cima)"/>
    <path class="g-area s" d="${area}" clip-path="url(#fl-baixo)"/>
    <path class="g-linha m" d="${linha}"/>
    ${hits}
    ${trocas}
    ${agoraMarca}
  </svg>`;
}

// ---------------------------------------------------------------- parciais ----
function parciaisFarense(j) {
  return (j.parciais || []).map(([p, casa, fora]) => ({
    p,
    nos: Number(j.emCasa ? casa : fora) || 0,
    eles: Number(j.emCasa ? fora : casa) || 0,
  }));
}

export function descreverParciais(j) {
  const l = parciaisFarense(j);
  return `Pontos por período, Farense contra adversário. ${l.map((q) => `${nomePeriodo(q.p)}: ${q.nos}-${q.eles}`).join('; ')}.`;
}

// Barras agrupadas: pontos de cada equipa em cada período. O valor aparece
// sempre por cima da barra e o vencedor do período fica a negrito.
export function barrasParciais(j, largura) {
  const lista = parciaisFarense(j);
  if (!lista.length) return '';
  const compacto = largura < 560;
  const H = compacto ? 170 : 200;
  const M = { top: 22, right: 12, bottom: 26, left: compacto ? 30 : 38 };
  const W = Math.max(260, Math.round(largura));
  const plotW = W - M.left - M.right;
  const base = H - M.bottom;
  const plotH = base - M.top;

  const max = Math.max(1, ...lista.map((q) => Math.max(q.nos, q.eles)));
  const passo = max <= 20 ? 5 : max <= 40 ? 10 : 20;
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const py = (v) => base - (v / topo) * plotH;

  const ticks = [];
  for (let v = 0; v <= topo; v += passo) ticks.push(v);
  const grade = ticks.map((v) => `<line class="g-grade${v === 0 ? ' zero' : ''}"
    x1="${M.left}" y1="${py(v).toFixed(1)}" x2="${W - M.right}" y2="${py(v).toFixed(1)}"/>`).join('');
  const eixoY = ticks.map((v) => `<text class="g-eixo" x="${M.left - 7}" y="${py(v).toFixed(1)}"
    text-anchor="end" dominant-baseline="middle">${v}</text>`).join('');

  const grupo = plotW / lista.length;
  const bw = Math.max(8, Math.min(34, grupo * 0.3));
  const folga = 4;
  const barras = lista.map((q, i) => {
    const cx = M.left + (i + 0.5) * grupo;
    const x1 = cx - folga / 2 - bw;
    const x2 = cx + folga / 2;
    const un = (x, v, cls, forte) => {
      const h = Math.max(v ? 2 : 0, (v / topo) * plotH);
      return `<rect class="g-bar ${cls}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>
        <text class="g-valor${forte ? ' forte' : ''}" x="${(x + bw / 2).toFixed(1)}" y="${(base - h - 5).toFixed(1)}" text-anchor="middle">${v}</text>`;
    };
    return `<g><title>${esc(`${nomePeriodo(q.p)} · Farense ${q.nos}-${q.eles}`)}</title>
      ${un(x1, q.nos, 'a', q.nos >= q.eles)}
      ${un(x2, q.eles, 'b', q.eles >= q.nos)}
      <text class="g-eixo" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${nomePeriodo(q.p)}</text>
    </g>`;
  }).join('');

  return `<svg class="g-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    role="presentation" focusable="false" aria-hidden="true">
    ${grade}${eixoY}${barras}
  </svg>`;
}

// --------------------------------------------------------------- liderança ----
export function descreverLideranca(j) {
  const l = j.lideranca;
  if (!l) return '';
  const nos = j.emCasa ? l.maiorCasa : l.maiorFora;
  const eles = j.emCasa ? l.maiorFora : l.maiorCasa;
  return `Maior vantagem: Farense ${nos ?? 0} pontos, adversário ${eles ?? 0}. ${l.empates ?? 0} empates e ${l.trocas ?? 0} trocas de liderança.`;
}

// Duas barras horizontais com a maior vantagem de cada equipa.
export function barrasLideranca(j, largura) {
  const l = j.lideranca;
  if (!l) return '';
  const nos = Number(j.emCasa ? l.maiorCasa : l.maiorFora) || 0;
  const eles = Number(j.emCasa ? l.maiorFora : l.maiorCasa) || 0;
  const nomeAdv = j.emCasa ? j.fora : j.casa;
  const W = Math.max(260, Math.round(largura));
  const linha = 44;
  const H = linha * 2;
  const reservado = 34;
  const max = Math.max(10, nos, eles);
  const cortar = (s) => {
    const n = Math.max(8, Math.floor(W / 7));
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
  };
  const row = (i, nome, v, cls) => {
    const y = i * linha;
    const w = v ? Math.max(3, (v / max) * (W - reservado)) : 0;
    return `<text class="g-rotulo" x="0" y="${y + 13}">${esc(cortar(nome))}</text>
      <rect class="g-bar ${cls}" x="0" y="${y + 21}" width="${w.toFixed(1)}" height="12" rx="2"/>
      <text class="g-valor forte" x="${(w + 6).toFixed(1)}" y="${y + 31}">${v}</text>`;
  };
  return `<svg class="g-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    role="presentation" focusable="false" aria-hidden="true">
    ${row(0, 'SC Farense', nos, 'a')}${row(1, nomeAdv || 'Adversário', eles, 'b')}
  </svg>`;
}
