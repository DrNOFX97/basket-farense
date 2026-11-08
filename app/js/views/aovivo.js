import * as F from '../format.js';
import * as D from '../data.js';
import * as P from '../painel.js';
import { esc, card, logo } from '../ui.js';
import { marcadores, porPeriodo, tabelaBox, cabecalhoBox } from './jogo.js';

let timer = null;
let vivo = false;

const TEXTO = {
  FOUL: 'Falta',
  RECEIVE: 'Falta sofrida',
  TIMEOUT: 'Timeout',
  REBOUND: 'Ressalto',
  ASSIST: 'Assistência',
  STEAL: 'Roubo',
  BLOCK: 'Desarme',
  TURNOVER: 'Perda',
};

function textoAccao(a) {
  const [, , , , code, sub, val, ok] = a;
  if (code === 'POINTS') {
    if (sub === 'FREE_THROW') return { t: ok ? 'LL convertido' : 'LL falhado', c: ok ? 'pts' : 'miss' };
    const pts = val || (sub === 'OUT_ARC' ? 3 : 2);
    return { t: `${pts} pts${ok ? '' : ' falhados'}`, c: ok ? 'pts' : 'miss' };
  }
  if (code === 'SWAP') return { t: sub === 'SWAP_IN' ? 'Entra' : 'Sai', c: 'mut' };
  return { t: TEXTO[code] || code, c: '' };
}

function nomes(j) {
  const m = {};
  for (const lado of ['casa', 'fora']) {
    for (const p of (j.jogadores && j.jogadores[lado]) || []) {
      if (p.fid) m[String(p.fid)] = p.nome;
    }
  }
  return m;
}

function placar(j, mapaL) {
  const [casa, fora] = j.pontos || [0, 0];
  const live = j.status === 'LIVE';
  return `<div class="sb">
    <div class="sb-row">
      <div class="sb-team">${logo(mapaL.get(String(j.casaFid)), 'tlogo-lg')}${esc(j.casa)}<small>casa</small></div>
      <div class="sb-sc">${casa ?? 0}<i>–</i>${fora ?? 0}</div>
      <div class="sb-team f">${logo(mapaL.get(String(j.foraFid)), 'tlogo-lg')}${esc(j.fora)}<small>fora</small></div>
    </div>
    <div class="sb-meta">
      ${live
        ? `<b>● A decorrer</b> · P${j.periodo ?? '—'}${j.relogio ? ' · ' + F.relogio(j.relogio) : ''}`
        : esc(j.status || '')}
      ${j.jornada ? ' · ' + esc(j.jornada) : ''}
    </div>
    ${(j.parciais || []).length
      ? `<div class="qt">${j.parciais.map(([p, a, b]) => `<span>P${p} <b>${a}-${b}</b></span>`).join('')}</div>`
      : ''}
  </div>`;
}

function feed(j) {
  const mapa = nomes(j);
  const itens = D.cronologia(j, j.equipa && j.equipa.teamFid).slice(-30).reverse();
  if (!itens.length) return '<div class="empty">Ainda sem acções registadas.</div>';

  return `<div class="pbp"><table><tbody>
    ${itens.map((it) => {
      if (it.marco) {
        return `<tr class="marco">
          <td class="per">${it.per ? 'P' + it.per : ''}</td>
          <td class="t">${esc((it.em || '').slice(11, 16))}</td>
          <td colspan="2">${esc(it.texto)}</td>
        </tr>`;
      }
      const a = it.a;
      const [per, tempo, fid, tipo] = a;
      const { t: texto, c } = textoAccao(a);
      let nome = mapa[String(fid)];
      if (!nome) nome = tipo === 'TEAM' ? (String(a[8]) === String(j.casaFid) ? j.casa : j.fora) : '—';
      return `<tr class="${c}">
        <td class="per">P${per}</td>
        <td class="t" title="registado às ${esc((a[9] || '').slice(11, 19))}">${F.relogioMs(tempo)}</td>
        <td>${esc(nome)}</td>
        <td>${esc(texto)}${a[10] ? ' <small class="ed" title="corrigida pela mesa">✎</small>' : ''}</td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

// Cartão com um gráfico simples (sem separadores nem filtro).
const cartaoGrafico = (tipo, j, legenda = '') => `<div class="card-b chart-b">
  ${P.contentorGrafico(tipo, j)}
  ${legenda}
</div>`;

function liderancaTexto(j) {
  const l = j.lideranca;
  if (!l) return '';
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  return `<p class="box-leg" style="padding:6px 0 0">${plural(l.empates || 0, 'empate', 'empates')} · ${
    plural(l.trocas || 0, 'troca de liderança', 'trocas de liderança')}</p>`;
}

export function desenhar(t, d, jogos) {
  const partes = [];
  const mapaL = D.logosEquipa(t);

  if (jogos.length) {
    for (const j of jogos) {
      const temPontos = (j.accoes || []).some((a) => a[4] === 'POINTS');
      partes.push(placar(j, mapaL));
      if (temPontos) partes.push(P.painelHTML(j));
      if (temPontos) partes.push(P.extrasHTML(j));
      if ((j.parciais || []).length) {
        partes.push(card('Pontos por período', cartaoGrafico('parciais', j, P.legendaSeries(j))));
      }
      const r = D.resumoFarense(j);
      const lado = j.emCasa ? 'casa' : 'fora';
      const adv = j.emCasa ? 'fora' : 'casa';
      const mar = marcadores(j.jogadores[lado]);
      const per = porPeriodo(r);
      if (mar || per) partes.push(`<div class="grid grid-2" style="margin-top:14px">${mar}${per}</div>`);
      if (j.lideranca) {
        partes.push(card('Liderança', cartaoGrafico('lideranca', j, liderancaTexto(j)), '<span class="side">maior vantagem</span>'));
      }
      partes.push(`<div style="margin-top:14px">${card(null, cabecalhoBox('SC Farense', lado) + tabelaBox(j.jogadores[lado], r.iniciais))}</div>`);
      partes.push(`<div style="margin-top:14px">${card(null, cabecalhoBox(j.emCasa ? j.fora : j.casa, adv) + tabelaBox(j.jogadores[adv], new Set(), 'adv'))}</div>`);
      partes.push(card('Últimas acções', feed(j)));
    }
  } else {
    partes.push(`<div class="aviso">
      <span class="live-dot" style="animation:none;background:var(--tx-3)"></span>
      Sem jogos do ${esc(t.nomeCurto)} a decorrer neste momento.
    </div>`);
  }

  const rodape = `<p class="nota">
    ${d.atualizado ? `Actualizado às ${esc(d.atualizado.slice(11))}.` : ''}
    A informação é lida da plataforma a cada ${vivo ? '5' : '20'} segundos.
    ${d.erro ? `<br><span style="color:var(--loss)">${esc(d.erro)}</span>` : ''}
  </p>`;

  return partes.join('') + rodape;
}

export default {
  render() {
    vivo = false;
    return `<div id="live-root"><div class="empty">A ligar ao marcador…</div></div>`;
  },

  mount(root, t) {
    const alvo = root.querySelector('#live-root');
    let parado = false;
    let ultimos = [];
    const limparPainel = P.montar(alvo, () => ultimos);

    async function tick() {
      if (parado) return;
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
        const d = await r.json();
        const meus = (lista) => (lista || []).filter(
          (j) => String(j.equipa.teamFid) === String(t.teamFid),
        );
        const jogos = meus(d.jogos).map((j) => ({
          ...j, emCasa: String(j.casaFid) === String(t.teamFid),
        }));
        ultimos = jogos;
        vivo = jogos.some((j) => j.status === 'LIVE');
        const repor = P.guardarFoco(alvo);
        alvo.innerHTML = desenhar(t, d, jogos);
        P.pintar(alvo, jogos);
        repor();
        document.dispatchEvent(new CustomEvent('swish:live', { detail: { vivo: vivo || jogos.length > 0 } }));
      } catch (e) {
        vivo = false;
        alvo.innerHTML = `<div class="aviso erro">Não foi possível falar com o servidor: ${esc(e.message)}</div>`;
      }
      if (!parado) timer = setTimeout(tick, vivo ? 5000 : 20000);
    }

    tick();

    return () => {
      parado = true;
      limparPainel();
      clearTimeout(timer);
      timer = null;
    };
  },
};
