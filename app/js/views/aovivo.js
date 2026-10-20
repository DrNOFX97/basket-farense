import * as F from '../format.js';
import * as D from '../data.js';
import { esc, vazio, card, logo } from '../ui.js';

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
  const acts = (j.accoes || []).slice(-15).reverse();
  if (!acts.length) return '<div class="empty">Ainda sem acções registadas.</div>';

  return `<div class="pbp"><table><tbody>
    ${acts.map((a) => {
      const [per, tempo, fid, tipo] = a;
      const hora = F.relogio(tempo);
      const { t: texto, c } = textoAccao(a);
      let nome = mapa[String(fid)];
      if (!nome) nome = tipo === 'TEAM' ? '' : '—';
      return `<tr class="${c}">
        <td class="per">P${per}</td>
        <td class="t">${hora}</td>
        <td>${esc(nome)}</td>
        <td>${esc(texto)}</td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

function desenhar(t, d, jogos, proximos) {
  const partes = [];
  const mapaL = D.logosEquipa(t);

  if (jogos.length) {
    for (const j of jogos) {
      partes.push(placar(j, mapaL));
      partes.push(card('Últimas acções', feed(j)));
    }
  } else {
    partes.push(`<div class="aviso">
      <span class="live-dot" style="animation:none;background:var(--tx-3)"></span>
      Sem jogos do ${esc(t.nomeCurto)} a decorrer neste momento.
    </div>`);
  }

  if (proximos.length) {
    partes.push(card('Próximos jogos', `<div class="mlist">
      ${proximos.slice(0, 4).map((j) => {
        const emCasa = String(j.casaFid) === String(t.teamFid);
        const adv = emCasa ? j.fora : j.casa;
        const advFid = emCasa ? j.foraFid : j.casaFid;
        const quando = F.quando(j.inicio);
        return `<div class="mrow mrow-estatico">
          <div class="mdate"><b>${F.dia(j.inicio)}</b>${F.mes(j.inicio)}</div>
          <div class="mopp"><b class="mteam">${logo(mapaL.get(String(advFid)), 'tlogo-sm')}<span>${esc(adv)}</span></b>
            <span>${[emCasa ? 'Casa' : 'Fora', F.hora(j.inicio), j.jornada]
              .filter(Boolean).map(esc).join(' · ')}</span></div>
          <div class="mscore dim">${esc(quando)}</div>
          <span></span>
        </div>`;
      }).join('')}
    </div>`));
  }

  if (!jogos.length && !proximos.length) {
    partes.push(card(null, vazio('Nada agendado',
      'Não há jogos a decorrer nem datas futuras para este escalão.')));
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

    async function tick() {
      if (parado) return;
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
        const d = await r.json();
        const meus = (lista) => (lista || []).filter(
          (j) => String(j.equipa.teamFid) === String(t.teamFid),
        );
        const jogos = meus(d.jogos);
        const proximos = meus(d.proximos);
        vivo = jogos.some((j) => j.status === 'LIVE');
        alvo.innerHTML = desenhar(t, d, jogos, proximos);
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
      clearTimeout(timer);
      timer = null;
    };
  },
};
