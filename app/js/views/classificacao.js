import * as F from '../format.js';
import * as D from '../data.js';
import { esc, card, vazio, logo } from '../ui.js';

export default {
  render(t) {
    const c = D.classificacao(t);
    if (!c || !c.linhas.length) {
      return card('Classificação', vazio('Sem classificação publicada',
        'Esta competição não tem tabela disponível na plataforma.'));
    }

    const linhas = c.linhas.map((l) => `<tr class="${l.eu ? 'eu' : ''}">
      <td class="pos">${esc(l.pos)}</td>
      <td class="name"><span class="tname">${logo(l.logo, 'tlogo-sm')}<span>${esc(l.nome)}</span></span></td>
      <td>${l.j ?? '—'}</td>
      <td>${l.v ?? '—'}</td>
      <td>${l.d ?? '—'}</td>
      <td>${l.pm != null ? F.num(l.pm, 0) : '—'}</td>
      <td>${l.ps != null ? F.num(l.ps, 0) : '—'}</td>
      <td>${l.dif != null ? (l.dif > 0 ? '+' : '') + F.num(l.dif, 0) : '—'}</td>
      <td class="pts">${l.pts ?? '—'}</td>
    </tr>`).join('');

    return `
      <div class="head-mini">
        <h2>${esc(c.grupo || t.competicao)}</h2>
        <span>${esc(t.projeto || '')}${t.projeto ? ' · ' : ''}${esc(t.epoca)}</span>
      </div>
      ${card(null, `<ul class="cards-m">${c.linhas.map((l) => `<li class="ccard ${l.eu ? 'eu' : ''}">
        <span class="cpos">${esc(l.pos)}</span>
        <div class="pmain">
          <strong class="tname">${logo(l.logo, 'tlogo-sm')}<span>${esc(l.nome)}</span></strong>
          <span>${l.j ?? '—'} J · ${l.v ?? '—'}–${l.d ?? '—'} · ${l.pm != null ? F.num(l.pm, 0) : '—'}–${l.ps != null ? F.num(l.ps, 0) : '—'} · ${l.dif != null ? (l.dif > 0 ? '+' : '') + F.num(l.dif, 0) : '—'} DIF</span>
        </div>
        <div class="ppts"><b>${l.pts ?? '—'}</b><span>PTS</span></div>
      </li>`).join('')}</ul><div class="tw tw-alt"><table>
        <thead><tr>
          <th scope="col">#</th><th scope="col" class="name">Equipa</th>
          <th scope="col">J</th><th scope="col">V</th><th scope="col">D</th>
          <th scope="col">PM</th><th scope="col">PS</th><th scope="col">DIF</th>
          <th scope="col" class="pts">PTS</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>`)}
      <p class="nota">J = jogos disputados · V = vitórias · D = derrotas ·
      PM = pontos marcados · PS = pontos sofridos · DIF = diferença ·
      PTS = pontos de classificação (2 por vitória, 1 por derrota).
      A ordem é a publicada pela organização da competição.</p>`;
  },
};
