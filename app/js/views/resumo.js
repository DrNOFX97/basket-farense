import * as F from '../format.js';
import * as D from '../data.js';
import * as G from '../charts.js';
import { esc, pill, card, vazio, barra, logo, avatar } from '../ui.js';

function parciais(j) {
  if (!j.parciais || !j.parciais.length) return '';
  return `<div class="qt">${j.parciais.map(([p, a, b]) => {
    const meu = j.emCasa ? a : b;
    const adv = j.emCasa ? b : a;
    return `<span>P${p} <b>${meu}-${adv}</b></span>`;
  }).join('')}</div>`;
}

function cartaoProximo(t, j, mapaL) {
  if (!j) {
    return card('Próximo jogo', vazio('Sem jogos marcados', 'Ainda não há datas para esta equipa.'));
  }
  const adv = j.emCasa ? j.fora : j.casa;
  const advFid = j.emCasa ? j.foraFid : j.casaFid;
  const q = F.quando(j.data);
  return card('Próximo jogo', `
    <div class="card-b prox">
      <div class="prox-data">${esc(F.dataLonga(j.data))}</div>
      <div class="prox-adv">${logo(mapaL.get(String(advFid)), 'tlogo-md')}${esc(adv)}</div>
      <div class="prox-meta">
        <span class="tag">${j.emCasa ? 'Em casa' : 'Fora'}</span>
        ${j.local ? `<span class="tag tag-mut">${esc(j.local)}</span>` : ''}
        ${j.jornada ? `<span class="tag tag-mut">${esc(j.jornada)}</span>` : ''}
      </div>
      ${q ? `<div class="countdown">${esc(q)}</div>` : ''}
    </div>`);
}

function cartaoUltimo(t, j, mapaL) {
  if (!j) {
    return card('Último resultado', vazio('Ainda sem jogos', 'Esta equipa ainda não disputou nenhum jogo.'));
  }
  const adv = j.emCasa ? j.fora : j.casa;
  const advFid = j.emCasa ? j.foraFid : j.casaFid;
  const forma = D.forma(t, 5);
  return card('Último resultado', `
    <div class="card-b prox">
      <div class="prox-data">${esc(F.dataCurta(j.data))} · ${j.emCasa ? 'em casa' : 'fora'}</div>
      <div class="res-linha">
        ${pill(j.resultado)}
        <div class="res-sc">${j.meus}<i>–</i>${j.adv}</div>
      </div>
      <div class="prox-adv prox-adv-sm">${logo(mapaL.get(String(advFid)), 'tlogo-sm')}${esc(adv)}</div>
      ${parciais(j)}
    </div>
    <div class="card-h" style="border-top:1px solid var(--line);border-bottom:0">
      <h2>Forma</h2>
      <div class="forma">${forma.map((x) => pill(x.resultado)).join('') || '<span class="mut">—</span>'}</div>
    </div>`);
}

function miniClassificacao(t) {
  const c = D.classificacao(t);
  if (!c || !c.linhas.length) return card('Classificação', vazio('Sem classificação disponível'));

  let linhas = c.linhas.slice(0, 6);
  const eu = c.linhas.find((l) => l.eu);
  if (eu && !linhas.includes(eu)) linhas = [...c.linhas.slice(0, 5), null, eu];

  const corpo = linhas.map((l) => {
    if (!l) return '<tr><td colspan="6" class="mut" style="text-align:center">…</td></tr>';
    return `<tr class="${l.eu ? 'eu' : ''}">
      <td class="pos">${esc(l.pos)}</td>
      <td class="name"><span class="tname">${logo(l.logo, 'tlogo-sm')}<span>${esc(l.nome)}</span></span></td>
      <td>${l.j ?? '—'}</td>
      <td>${l.v ?? '—'}</td>
      <td>${l.d ?? '—'}</td>
      <td class="pts">${l.pts ?? '—'}</td>
    </tr>`;
  }).join('');

  return card('Classificação', `
    <div class="tw"><table>
      <thead><tr>
        <th scope="col">#</th><th scope="col" class="name">Equipa</th>
        <th scope="col">J</th><th scope="col">V</th><th scope="col">D</th>
        <th scope="col" class="pts" title="2 pontos por vitória, 1 por derrota">PTS</th>
      </tr></thead>
      <tbody>${corpo}</tbody>
    </table></div>`, c.grupo ? `<span class="side">${esc(c.grupo)}</span>` : '');
}

function marcadores(t) {
  const lista = D.statsPlantel(t).filter((a) => a.j > 0).slice(0, 6);
  if (!lista.length) return card('Melhores marcadores', vazio('Sem estatísticas', 'Ainda não há boxscores desta equipa.'));

  return card('Melhores marcadores', `
    <div class="scorers">${lista.map((a, i) => `
      <div class="scorer">
        <span class="srank">${i + 1}</span>
        <span class="snum">${esc(a.num || '—')}</span>
        ${avatar(a.foto, a.nome, 'pavatar-sm')}
        <div class="snome">${esc(a.nome)}<small>${a.pts} pts em ${a.j} jogos</small></div>
        <span class="sppg"><b>${F.num(a.ppg, 1)}</b><small>ppm</small></span>
      </div>`).join('')}
    </div>`, '<span class="side">pontos por jogo</span>');
}

function numeros(t) {
  const a = t.agregado || {};
  const r = t.resumo || {};
  const tt = D.totaisEquipa(t);

  const jogos = a.games ?? r.realizados ?? 0;
  const v = a.wins ?? r.v ?? 0;
  const d = a.losses ?? r.d ?? 0;
  const pct = (x) => (x === null ? '—' : `${F.num(x * 100, 0)}%`);

  const kpis = [
    ['Jogos', jogos],
    ['Vitórias', v],
    ['Derrotas', d],
    ['Pontos/jogo', a.pointsAVG != null ? F.num(a.pointsAVG, 1) : (r.media != null ? F.num(r.media, 1) : '—')],
    ['Sofridos/jogo', a.pointsConcededAVG != null ? F.num(a.pointsConcededAVG, 1) : (r.mediaSofrida != null ? F.num(r.mediaSofrida, 1) : '—')],
    ['Diferença', a.plusMinus != null ? (a.plusMinus > 0 ? '+' : '') + F.num(a.plusMinus, 0) : '—'],
    ['2 pontos conv.', tt.c2 || '—'],
    ['3 pontos conv.', tt.c3 || '—'],
    ['Lances livres', pct(tt.pll)],
    ['Faltas/jogo', a.foulsAVG != null ? F.num(a.foulsAVG, 1) : '—'],
    ['Valorização', tt.val || '—'],
    ['Com boxscore', `${tt.boxscores}/${tt.jogados}`],
  ];

  return card('A época em números', `
    <div class="card-b">
      <div class="kpis">${kpis.map(([k, v2]) => `
        <div class="kpi"><span>${esc(k)}</span><b>${esc(v2)}</b></div>`).join('')}
      </div>
      <p class="nota">A plataforma regista os lançamentos de campo apenas quando são
      convertidos: não existem falhados de 2 ou 3 pontos na fonte, por isso não há
      percentagem possível. Os lances livres, esses, estão completos.
      Ressaltos, assistências, roubos e desarmes também não são preenchidos.</p>
    </div>`);
}

function graficoPontos(t) {
  const jogos = D.realizados(t).filter((j) => j.meus != null);
  if (!jogos.length) {
    return card('Pontos marcados e sofridos', vazio('Ainda sem jogos',
      'O gráfico aparece quando houver resultados.'));
  }
  return card('Pontos marcados e sofridos', `
    <div class="card-b chart-b">
      <div class="grafico" id="grafico-pontos" role="img"></div>
    </div>`, `<span class="legenda">
      <span><i class="m"></i>Marcados</span>
      <span><i class="s"></i>Sofridos</span>
    </span>`);
}

export default {
  render(t) {
    const prox = D.proximoJogo(t);
    const ult = D.ultimoJogo(t);
    const mapaL = D.logosEquipa(t);
    return `
      <div class="grid grid-2">
        ${cartaoProximo(t, prox, mapaL)}
        ${cartaoUltimo(t, ult, mapaL)}
      </div>
      <div class="grid grid-2" style="margin-top:14px">
        ${miniClassificacao(t)}
        ${marcadores(t)}
      </div>
      <div style="margin-top:14px">${numeros(t)}</div>
      <div style="margin-top:14px">${graficoPontos(t)}</div>`;
  },

  mount(root, t) {
    const alvo = root.querySelector('#grafico-pontos');
    if (!alvo) return;
    const jogos = D.realizados(t).filter((j) => j.meus != null);
    let largura = 0;

    const desenhar = () => {
      const w = Math.round(alvo.clientWidth);
      if (!w || w === largura) return;
      largura = w;
      alvo.innerHTML = G.linhaPontos(jogos, w);
      alvo.setAttribute('aria-label', G.descreverPontos(jogos));
    };

    desenhar();

    if (typeof ResizeObserver !== 'undefined') {
      const observador = new ResizeObserver(desenhar);
      observador.observe(alvo);
      return () => observador.disconnect();
    }
    window.addEventListener('resize', desenhar);
    return () => window.removeEventListener('resize', desenhar);
  },
};
