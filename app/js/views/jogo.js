import * as F from '../format.js';
import * as D from '../data.js';
import * as G from '../charts.js';
import { esc, card, vazio, linhaCmp, logo, avatar } from '../ui.js';

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
let aba = 'resumo';

const ABAS = [['resumo', 'Resumo'], ['boxscore', 'Boxscore'], ['pbp', 'Play-by-play']];

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
  const mapaL = D.logosEquipa(t);

  const estado = j.estado === 'LIVE'
    ? '<b>a decorrer</b>'
    : (j.estado === 'NOT_STARTED' ? 'por começar' : 'terminado');

  const parciais = (j.parciais || []).length
    ? `<div class="qt">${j.parciais.map(([p, a, b]) => `<span>P${p} <b>${a}-${b}</b></span>`).join('')}</div>`
    : '';

  return `<div class="sb">
    <div class="sb-row">
      <div class="sb-team">${logo(mapaL.get(String(j.casaFid)), 'tlogo-lg')}${esc(j.casa)}<small>casa</small></div>
      <div class="sb-sc">${casaPts ?? '—'}<i>–</i>${foraPts ?? '—'}</div>
      <div class="sb-team f">${logo(mapaL.get(String(j.foraFid)), 'tlogo-lg')}${esc(j.fora)}<small>fora</small></div>
    </div>
    <div class="sb-meta">
      ${j.jogado ? `<span class="res res-${j.resultado === 'V' ? 'v' : 'd'}">${j.resultado === 'V' ? 'Vitória' : 'Derrota'}</span>` : ''}
      ${esc(F.dataLonga(j.data))}${j.local ? ' · ' + esc(j.local) : ''}
      ${j.jornada ? ' · ' + esc(j.jornada) : ''} · ${estado}
    </div>
    ${parciais}
    ${lideranca(j)}
  </div>`;
}

function cabecalhoBox(nome, lado) {
  return `<div class="card-h"><h2>${esc(nome)}</h2><span class="side">${lado}</span></div>`;
}

function tabelaBox(lista, iniciais = new Set()) {
  if (!lista || !lista.length) return vazio('Sem boxscore', 'Ainda não há estatísticas individuais deste jogo.');
  const jogadores = [...lista].sort((a, b) => (b.min || 0) - (a.min || 0) || (b.pts || 0) - (a.pts || 0));

  const linhas = jogadores.map((p) => `<tr>
    <td class="pos">${esc(p.num || '-')}</td>
    <td class="name"><span class="pname">${avatar(p.foto, p.nome, 'pavatar-sm')}<span>${esc(p.nome)}</span>${iniciais.has(String(p.fid)) ? ' <small class="ini" title="Cinco inicial">★</small>' : ''}</span></td>
    <td>${F.mmss(p.min)}</td>
    <td><b>${p.pts ?? 0}</b></td>
    <td>${p.c2}</td>
    <td>${p.c3}</td>
    <td>${p.cll}/${p.cll + p.fll}</td>
    <td class="${p.ft >= 5 ? 'f5' : p.ft === 4 ? 'f4' : ''}"${p.ft >= 5 ? ' title="Excluído por 5 faltas"' : p.ft === 4 ? ' title="4 faltas"' : ''}>${p.ft}</td>
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
      <th scope="col">#</th><th scope="col" class="name">Jogador</th>
      <th scope="col" title="Minutos jogados">MIN</th>
      <th scope="col" title="Pontos">PTS</th>
      <th scope="col" title="Cestos de 2 pontos convertidos">2P</th>
      <th scope="col" title="Cestos de 3 pontos convertidos">3P</th>
      <th scope="col" title="Lances livres convertidos / tentados">LL</th>
      <th scope="col" title="Faltas cometidas">FT</th>
      <th scope="col" title="Faltas sofridas">FR</th>
      <th scope="col" title="Valorização (índice FIBA)">VAL</th>
      <th scope="col" title="Diferença de pontos com o jogador em campo">+/−</th>
    </tr></thead>
    <tbody>${linhas}${total}</tbody>
  </table></div>
  <p class="box-leg"><b>MIN</b> minutos · <b>PTS</b> pontos · <b>2P / 3P</b> cestos convertidos · <b>LL</b> lances livres convertidos/tentados · <b>FT</b> faltas cometidas · <b>FR</b> faltas sofridas · <b>VAL</b> valorização · <b>+/−</b> diferença de pontos com o jogador em campo</p>`;
}

// Jogos sem boxscore: por realizar, terminados sem resultado ou só com o resultado.
function semDetalhe(t, j, ctx) {
  const adv = j.emCasa ? j.fora : j.casa;
  if (j.jogado) {
    return card('Só o resultado', `<div class="empty"><b>Sem boxscore nem play-by-play</b>A plataforma só tem o resultado deste jogo contra ${esc(adv)}.</div>`);
  }
  if (j.estado === 'LIVE') {
    return card('A decorrer', `<div class="empty"><b>Jogo em direto</b>
      <a href="#/${esc(ctx.epoca)}/${esc(t.id)}/ao-vivo">Abrir o marcador ao vivo →</a></div>`);
  }
  if (j.estado === 'CLOSED') {
    return card('Resultado em falta', `<div class="empty"><b>Jogo terminado, sem resultado registado</b>A plataforma ainda não tem o marcador nem as estatísticas. Os dados atualizam-se sozinhos.</div>`);
  }
  const quando = F.quando(j.data);
  return card('Jogo por realizar', `<div class="empty"><b>${esc(F.dataLonga(j.data))}${quando ? ' (' + esc(quando) + ')' : ''}</b>
    ${j.emCasa ? 'Em casa' : 'Fora'} contra ${esc(adv)}${j.local ? ' · ' + esc(j.local) : ''}.<br>As estatísticas aparecem aqui depois do jogo.</div>`);
}

function destaques(j, r) {
  const d = r.destaques;
  const item = (rotulo, p, k, unidade, sinal = false) => (p ? `<div class="kpi"><span>${rotulo}</span>
    <b>${esc(p.nome)}</b><span class="kpi-v">${sinal && p[k] > 0 ? '+' : ''}${p[k]} ${unidade}</span></div>` : '');
  return card('Destaques', `<div class="card-b kpis kpis-sm kpis-3">
    ${item('Marcador', d.pts, 'pts', 'pontos')}
    ${item('Valorização', d.val, 'val', 'de valorização')}
    ${item('+/−', d.pm, 'pm', 'em campo', true)}
  </div>`);
}

function porPeriodo(r) {
  if (!r.periodos.length) return '';
  const soma = (k) => r.periodos.reduce((s, p) => s + (p[k] || 0), 0);
  const linha = (rot, p) => `<tr><td>${rot}</td><td><b>${p.pts}</b></td><td>${p.sof}</td><td>${p.faltas}</td><td>${p.timeouts}</td></tr>`;
  return card('Por período', `<div class="tw"><table>
    <thead><tr><th scope="col">Período</th><th scope="col" title="Pontos marcados">Marc.</th>
      <th scope="col" title="Pontos sofridos">Sof.</th><th scope="col" title="Faltas cometidas">Faltas</th>
      <th scope="col" title="Timeouts pedidos">TO</th></tr></thead>
    <tbody>${r.periodos.map((p) => linha(`P${p.per}`, p)).join('')}
    <tr class="total"><td>Total</td><td><b>${soma('pts')}</b></td><td>${soma('sof')}</td><td>${soma('faltas')}</td><td>${soma('timeouts')}</td></tr>
    </tbody></table></div>`);
}

function comparador(j) {
  const eu = j.emCasa ? j.jogadores.casa : j.jogadores.fora;
  const ad = j.emCasa ? j.jogadores.fora : j.jogadores.casa;
  const a = D.totaisJogo(eu);
  const b = D.totaisJogo(ad);
  if (!a.pts && !b.pts) return '';
  const nomeAdv = j.emCasa ? j.fora : j.casa;
  const pctLL = (t) => (t.cll + t.fll ? Math.round((t.cll / (t.cll + t.fll)) * 100) : 0);
  const pc = (x) => `${x}%`;
  return card('Comparação', `<div class="card-b"><div class="cmp">
      ${linhaCmp('Pontos', a.pts, b.pts)}
      ${linhaCmp('2 pontos conv.', a.c2, b.c2)}
      ${linhaCmp('3 pontos conv.', a.c3, b.c3)}
      ${linhaCmp('Lances livres (% conv.)', pctLL(a), pctLL(b), pc)}
      ${linhaCmp('Faltas (menos é melhor)', a.ft, b.ft, (x) => x, { menosMelhor: true, semBarra: true })}
      ${linhaCmp('Valorização', a.val, b.val)}
    </div>
    <div class="cmp-legenda">
      <span><i class="sw a"></i>SC Farense</span>
      <span><i class="sw b"></i>${esc(nomeAdv)}</span>
    </div></div>`);
}

// Linha única no placar, da perspectiva do Farense.
function lideranca(j) {
  const l = j.lideranca;
  if (!l) return '';
  const nomeAdv = j.emCasa ? j.fora : j.casa;
  const nos = j.emCasa ? l.maiorCasa : l.maiorFora;
  const eles = j.emCasa ? l.maiorFora : l.maiorCasa;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const fim = l.empates || l.trocas
    ? `${plural(l.empates || 0, 'empate', 'empates')} · ${plural(l.trocas || 0, 'troca de liderança', 'trocas de liderança')}`
    : 'sem empates nem trocas de liderança';
  return `<div class="sb-lid">Maior vantagem: Farense ${nos ?? 0} · ${esc(nomeAdv)} ${eles ?? 0} · ${fim}</div>`;
}

function pbp(j, nomes) {
  if (!j.accoes || !j.accoes.length) {
    return vazio('Sem play-by-play', 'Este jogo não tem registo de acções.');
  }

  // Só as acções do Farense; as do adversário contam apenas para o marcador.
  const meu = String(j.emCasa ? j.casaFid : j.foraFid);
  let nos = 0;
  let eles = 0;
  const linhas = [];

  for (const it of D.cronologia(j)) {
    if (it.marco) {
      if (filtro === 'todos') {
        linhas.push(`<tr class="marco">
          <td class="per">${it.per ? 'P' + it.per : ''}</td>
          <td class="t">${esc((it.em || '').slice(11, 16))}</td>
          <td colspan="3" class="name">${esc(it.texto)}</td>
        </tr>`);
      }
      continue;
    }
    const a = it.a;
    const [per, t, fid, tipoActor, code, sub, val, ok] = a;
    const eq = String(a[8]);
    const emCasa = eq === String(j.casaFid);

    if (code === 'POINTS' && ok) {
      if (eq === meu) nos += val || 0;
      else eles += val || 0;
    }
    if (eq !== meu) continue;

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
      <td class="t" title="registado às ${esc((a[9] || '').slice(11, 19))}">${F.relogioMs(t)}</td>
      <td class="name">${esc(nome)}</td>
      <td>${esc(txt)}${a[10] ? ' <small class="ed" title="corrigida pela mesa">✎</small>' : ''}</td>
      <td class="sc">${code === 'POINTS' && ok ? `${nos}-${eles}` : ''}</td>
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
    aba = 'resumo';
    const r = D.resumoFarense(j);
    const nomes = D.nomesJogo(j);

    const corpo = j.detalhe
      ? `<div class="seg abas-jogo" role="tablist" aria-label="Secções do jogo" style="margin-top:14px">
           ${ABAS.map(([k, n]) => `<button type="button" role="tab" id="aba-${k}" data-aba="${k}" aria-controls="painel-${k}"
             aria-selected="${aba === k}" class="${aba === k ? 'on' : ''}">${n}</button>`).join('')}
         </div>
         <div data-painel="resumo" id="painel-resumo" role="tabpanel" aria-labelledby="aba-resumo">
         ${(j.accoes || []).some((a) => a[4] === 'POINTS') ? `<div style="margin-top:14px">${card('Evolução do marcador', `<div class="card-b chart-b">
             <div class="grafico" id="grafico-evolucao" role="img"></div>
             <p class="box-leg" style="padding:6px 0 0">Diferença de pontos do Farense a cada cesto: acima de zero o Farense está a ganhar.</p>
           </div>`)}</div>` : ''}
         <div class="grid grid-2" style="margin-top:14px">${porPeriodo(r)}${comparador(j)}</div>
         <div style="margin-top:14px">${destaques(j, r)}</div>
         </div>
         <div data-painel="boxscore" id="painel-boxscore" role="tabpanel" aria-labelledby="aba-boxscore" hidden>
         <div style="margin-top:14px">${card(null, cabecalhoBox('SC Farense', j.emCasa ? 'casa' : 'fora') + tabelaBox(j.emCasa ? j.jogadores.casa : j.jogadores.fora, r.iniciais))}</div>
         </div>
         <div data-painel="pbp" id="painel-pbp" role="tabpanel" aria-labelledby="aba-pbp" hidden>
         <div class="card" style="margin-top:14px">
           <div class="card-h">
             <h2>Play-by-play</h2>
             <div class="seg seg-sm" role="group" aria-label="Filtrar acções">
               ${[['todos', 'Tudo'], ['cestos', 'Cestos'], ['faltas', 'Faltas'], ['subs', 'Subs']]
                 .map(([k, n]) => `<button type="button" data-pbp="${k}" class="${filtro === k ? 'on' : ''}">${n}</button>`).join('')}
             </div>
           </div>
           <div id="pbp-wrap">${pbp(j, nomes)}</div>
         </div>
         </div>`
      : `<div style="margin-top:14px">${semDetalhe(t, j, ctx)}</div>`;

    return `<a class="voltar" href="#/${esc(ctx.epoca)}/${esc(t.id)}/jogos">← Jogos</a>
      ${placar(t, j)}
      ${corpo}`;
  },

  mount(root, t, ctx) {
    const j = D.jogo(t, ctx.param);
    if (!j || !j.detalhe) return;
    const nomes = D.nomesJogo(j);

    const graf = root.querySelector('#grafico-evolucao');
    let largura = 0;
    const desenhar = () => {
      const w = Math.round(graf.clientWidth);
      if (!w || w === largura) return;
      largura = w;
      graf.innerHTML = G.linhaEvolucao(j, w);
      graf.setAttribute('aria-label', G.descreverEvolucao(j));
    };
    let limpar;
    if (graf) {
      desenhar();
      if (typeof ResizeObserver !== 'undefined') {
        const obs = new ResizeObserver(desenhar);
        obs.observe(graf);
        limpar = () => obs.disconnect();
      } else {
        window.addEventListener('resize', desenhar);
        limpar = () => window.removeEventListener('resize', desenhar);
      }
    }

    const abas = [...root.querySelectorAll('[data-aba]')];
    const mostrar = (k) => {
      aba = k;
      abas.forEach((b) => {
        const on = b.dataset.aba === k;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      root.querySelectorAll('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== k; });
    };
    abas.forEach((b, i) => {
      b.addEventListener('click', () => mostrar(b.dataset.aba));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const prox = abas[(i + d + abas.length) % abas.length];
        mostrar(prox.dataset.aba);
        prox.focus();
      });
    });
    mostrar(aba);

    root.querySelectorAll('[data-pbp]').forEach((b) => {
      b.addEventListener('click', () => {
        filtro = b.dataset.pbp;
        root.querySelectorAll('[data-pbp]').forEach((x) => x.classList.toggle('on', x === b));
        const wrap = root.querySelector('#pbp-wrap');
        if (wrap) wrap.innerHTML = pbp(j, nomes);
      });
    });

    return limpar;
  },
};
