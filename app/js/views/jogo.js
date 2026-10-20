import * as F from '../format.js';
import * as D from '../data.js';
import { esc, card, vazio, linhaCmp } from '../ui.js';

const TIPO = {
  FOUL: 'Falta',
  RECEIVE: 'Falta sofrida',
  TIMEOUT: 'Timeout',
  REBOUND: 'Ressalto',
  ASSIST: 'Assistência',
  STEAL: 'Roubo',
  BLOCK: 'Desarme',
  TURNOVER: 'Perda de bola',
};

let filtro = 'todos';

function accaoTexto(a) {
  const [, , , , code, sub, val, ok] = a;
  if (code === 'POINTS') {
    if (sub === 'FREE_THROW') {
      return { txt: ok ? 'Lance livre convertido' : 'Lance livre falhado', cls: ok ? 'pts' : 'miss' };
    }
    if (sub === 'DUNK') return { txt: ok ? 'Afundanço' : 'Afundanço falhado', cls: ok ? 'pts' : 'miss' };
    const pts = val || (sub === 'OUT_ARC' ? 3 : 2);
    return { txt: `${pts} pontos${ok ? '' : ' falhados'}`, cls: ok ? 'pts' : 'miss' };
  }
  if (code === 'SWAP') return { txt: sub === 'SWAP_IN' ? 'Entra' : 'Sai', cls: 'mut' };
  return { txt: TIPO[code] || code, cls: '' };
}

function placar(t, j) {
  const casaPts = j.jogado ? (j.emCasa ? j.meus : j.adv) : null;
  const foraPts = j.jogado ? (j.emCasa ? j.adv : j.meus) : null;

  const estado = j.estado === 'LIVE'
    ? '<b>a decorrer</b>'
    : (j.estado === 'NOT_STARTED' ? 'por começar' : 'terminado');

  const parciais = (j.parciais || []).length
    ? `<div class="qt">${j.parciais.map(([p, a, b]) => `<span>P${p} <b>${a}-${b}</b></span>`).join('')}</div>`
    : '';

  return `<div class="sb">
    <div class="sb-row">
      <div class="sb-team">${esc(j.casa)}<small>casa</small></div>
      <div class="sb-sc">${casaPts ?? '—'}<i>–</i>${foraPts ?? '—'}</div>
      <div class="sb-team f">${esc(j.fora)}<small>fora</small></div>
    </div>
    <div class="sb-meta">
      ${esc(F.dataLonga(j.data))}${j.local ? ' · ' + esc(j.local) : ''}
      ${j.jornada ? ' · ' + esc(j.jornada) : ''} · ${estado}
    </div>
    ${parciais}
  </div>`;
}

function cabecalhoBox(nome, lado) {
  return `<div class="card-h"><h2>${esc(nome)}</h2><span class="side">${lado}</span></div>`;
}

function tabelaBox(lista) {
  if (!lista || !lista.length) return vazio('Sem boxscore', 'Ainda não há estatísticas individuais deste jogo.');
  const jogadores = [...lista].sort((a, b) => (b.min || 0) - (a.min || 0) || (b.pts || 0) - (a.pts || 0));

  const linhas = jogadores.map((p) => `<tr>
    <td class="pos">${esc(p.num || '—')}</td>
    <td class="name">${esc(p.nome)}</td>
    <td>${F.mmss(p.min)}</td>
    <td><b>${p.pts ?? 0}</b></td>
    <td>${p.c2}</td>
    <td>${p.c3}</td>
    <td>${p.cll}/${p.cll + p.fll}</td>
    <td>${p.ft}</td>
    <td>${p.fr}</td>
    <td>${p.val}</td>
    <td>${p.pm > 0 ? '+' : ''}${p.pm}</td>
  </tr>`).join('');

  const tt = D.totaisJogo(lista);
  const total = `<tr class="total">
    <td></td><td class="name">Total</td>
    <td>${F.mmss(tt.min)}</td><td><b>${tt.pts}</b></td>
    <td>${tt.c2}</td>
    <td>${tt.c3}</td>
    <td>${tt.cll}/${tt.cll + tt.fll}</td>
    <td>${tt.ft}</td><td>${tt.fr}</td><td>${tt.val}</td>
    <td>${tt.pm > 0 ? '+' : ''}${tt.pm}</td>
  </tr>`;

  return `<div class="tw"><table class="box">
    <thead><tr>
      <th scope="col">#</th><th scope="col" class="name">Jogador</th><th scope="col">MIN</th>
      <th scope="col">PTS</th><th scope="col">2P</th><th scope="col">3P</th>
      <th scope="col">LL</th><th scope="col">FT</th><th scope="col">FR</th>
      <th scope="col">VAL</th><th scope="col">+/−</th>
    </tr></thead>
    <tbody>${linhas}${total}</tbody>
  </table></div>`;
}

function comparador(j) {
  const a = D.totaisJogo(j.jogadores.casa);
  const b = D.totaisJogo(j.jogadores.fora);
  if (!a.pts && !b.pts) return '';
  return card('Comparação', `<div class="card-b"><div class="cmp">
      ${linhaCmp('Pontos', a.pts, b.pts)}
      ${linhaCmp('2 pontos conv.', a.c2, b.c2)}
      ${linhaCmp('3 pontos conv.', a.c3, b.c3)}
      ${linhaCmp('Lances livres', a.cll, b.cll)}
      ${linhaCmp('Faltas', a.ft, b.ft)}
      ${linhaCmp('Valorização', a.val, b.val)}
    </div>
    <div class="cmp-legenda">
      <span><i class="sw a"></i>${esc(j.casa)}</span>
      <span><i class="sw b"></i>${esc(j.fora)}</span>
    </div></div>`);
}

function lideranca(j) {
  const l = j.lideranca;
  if (!l) return '';
  const itens = [
    ['Maior vantagem (casa)', l.maiorCasa],
    ['Maior vantagem (fora)', l.maiorFora],
    ['Empates', l.empates],
    ['Trocas de liderança', l.trocas],
  ];
  return card('Liderança', `<div class="card-b kpis kpis-sm">
    ${itens.map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${v ?? '—'}</b></div>`).join('')}
  </div>`);
}

function pbp(j, nomes) {
  if (!j.accoes || !j.accoes.length) {
    return vazio('Sem play-by-play', 'Este jogo não tem registo de acções.');
  }

  let hc = 0;
  let ac = 0;
  const linhas = [];

  for (const a of j.accoes) {
    const [per, t, fid, tipoActor, code, sub, val, ok] = a;
    const eq = String(a[8]);
    const emCasa = eq === String(j.casaFid);

    if (code === 'POINTS' && ok) {
      if (emCasa) hc += val || 0;
      else if (eq === String(j.foraFid)) ac += val || 0;
    }

    const mostra = filtro === 'todos'
      || (filtro === 'cestos' && code === 'POINTS')
      || (filtro === 'faltas' && (code === 'FOUL' || code === 'RECEIVE'))
      || (filtro === 'subs' && code === 'SWAP');
    if (!mostra) continue;

    const { txt, cls } = accaoTexto(a);
    let nome = nomes[String(fid)];
    if (!nome) nome = tipoActor === 'TEAM' ? (emCasa ? j.casa : j.fora) : '—';

    linhas.push(`<tr class="${cls}">
      <td class="per">P${per}</td>
      <td class="t">${F.relogio(t)}</td>
      <td><i class="dot ${emCasa ? 'a' : 'b'}"></i>${esc(nome)}</td>
      <td>${esc(txt)}</td>
      <td class="sc">${code === 'POINTS' && ok ? `${hc}-${ac}` : ''}</td>
    </tr>`);
  }

  if (!linhas.length) return vazio('Sem acções neste filtro');

  return `<div class="pbp"><table>
    <thead><tr>
      <th scope="col">P</th><th scope="col">Tempo</th><th scope="col" class="name">Jogador</th>
      <th scope="col">Acção</th><th scope="col">Marcador</th>
    </tr></thead>
    <tbody id="pbp-body">${linhas.join('')}</tbody>
  </table></div>`;
}

export default {
  render(t, ctx) {
    const j = D.jogo(t, ctx.param);
    if (!j) return vazio('Jogo não encontrado', 'Este jogo não pertence a esta equipa.');

    filtro = 'todos';
    const nomes = D.nomesJogo(j);

    const corpo = j.detalhe
      ? `<div class="grid grid-2" style="margin-top:14px">
           ${card('Parciais', `<div class="tw"><table>
             <thead><tr><th scope="col">Período</th><th scope="col">${esc(j.casa)}</th><th scope="col">${esc(j.fora)}</th></tr></thead>
             <tbody>${(j.parciais || []).map(([p, a, b]) => `<tr><td>P${p}</td><td>${a}</td><td>${b}</td></tr>`).join('')}
             <tr class="total"><td>Total</td><td><b>${j.emCasa ? j.meus : j.adv}</b></td><td><b>${j.emCasa ? j.adv : j.meus}</b></td></tr>
             </tbody></table></div>`)}
           ${lideranca(j)}
         </div>
         <div style="margin-top:14px">${comparador(j)}</div>
         <div style="margin-top:14px">${card(null, cabecalhoBox(j.casa, 'casa') + tabelaBox(j.jogadores.casa))}</div>
         <div style="margin-top:14px">${card(null, cabecalhoBox(j.fora, 'fora') + tabelaBox(j.jogadores.fora))}</div>
         <div class="card" style="margin-top:14px">
           <div class="card-h">
             <h2>Play-by-play</h2>
             <div class="seg seg-sm" role="group" aria-label="Filtrar acções">
               ${[['todos', 'Tudo'], ['cestos', 'Cestos'], ['faltas', 'Faltas'], ['subs', 'Subs']]
                 .map(([k, n]) => `<button type="button" data-pbp="${k}" class="${filtro === k ? 'on' : ''}">${n}</button>`).join('')}
             </div>
           </div>
           <div id="pbp-wrap">${pbp(j, nomes)}</div>
         </div>`
      : `<div style="margin-top:14px">${card('Detalhe indisponível',
          vazio('Sem boxscore para este jogo',
            'A plataforma só tem o resultado. Os jogos recentes têm play-by-play completo.'))}</div>`;

    return `<a class="voltar" href="#/${esc(ctx.epoca)}/${esc(t.id)}/jogos">← Jogos</a>
      ${placar(t, j)}
      ${corpo}`;
  },

  mount(root, t, ctx) {
    const j = D.jogo(t, ctx.param);
    if (!j || !j.detalhe) return;
    const nomes = D.nomesJogo(j);

    root.querySelectorAll('[data-pbp]').forEach((b) => {
      b.addEventListener('click', () => {
        filtro = b.dataset.pbp;
        root.querySelectorAll('[data-pbp]').forEach((x) => x.classList.toggle('on', x === b));
        const wrap = root.querySelector('#pbp-wrap');
        if (wrap) wrap.innerHTML = pbp(j, nomes);
      });
    });
  },
};
