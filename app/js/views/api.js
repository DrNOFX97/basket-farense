// Zona da API: cada pessoa pede a sua chave, vê-a uma única vez e, depois, só a
// pode revogar. O servidor guarda apenas o hash; aqui guardamos no browser a
// lista (id, nome, data) para permitir revogar, mas nunca a chave em si.
import { esc, card } from '../ui.js';

const ARMAZEM = 'api-chaves';

function lerLista() {
  try {
    const l = JSON.parse(localStorage.getItem(ARMAZEM) || '[]');
    return Array.isArray(l) ? l.filter((x) => x && typeof x.id === 'string') : [];
  } catch {
    return [];
  }
}

function gravarLista(lista) {
  try { localStorage.setItem(ARMAZEM, JSON.stringify(lista)); } catch { /* sem armazenamento */ }
}

function data(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function linhaChave(k) {
  return `<li class="api-chave" data-id="${esc(k.id)}">
    <div class="api-chave-txt">
      <b>${esc(k.nome || 'Sem nome')}</b>
      <span class="mut">criada a ${esc(data(k.criada))} · <code>…${esc(k.id.slice(-6))}</code></span>
    </div>
    <button type="button" class="api-btn api-btn-perigo" data-revogar="${esc(k.id)}">Revogar</button>
  </li>`;
}

const ENDPOINTS = [
  ['/api/v1/all', 'Tudo: épocas, equipas, classificação, plantel e jogos'],
  ['/api/v1/index', 'Épocas e equipas, com o endereço de cada uma'],
  ['/api/v1/<época>/<equipa>', 'Uma equipa completa'],
  ['/api/v1/<época>/<equipa>/jogos/<fid>', 'Um jogo, com boxscore e acções'],
];

export default {
  render() {
    const lista = lerLista();
    const base = location.origin;
    return `
      <header class="head">
        <div class="eyebrow">Para programadores</div>
        <h1>API</h1>
        <p class="comp">Os mesmos dados do site em JSON, para usares noutras apps.</p>
      </header>

      ${card('As tuas chaves', `
        <div class="card-b">
          <form class="api-form" id="api-form">
            <label class="sr-only" for="api-nome">Nome da chave</label>
            <input id="api-nome" class="api-input" type="text" maxlength="40"
              placeholder="Nome (opcional), ex.: App iOS" autocomplete="off">
            <button type="submit" class="api-btn api-btn-prim" id="api-criar">Gerar chave</button>
          </form>
          <p class="api-erro" id="api-erro" role="alert" hidden></p>
          <div id="api-nova" aria-live="polite"></div>
          <ul class="api-lista" id="api-lista">${lista.map(linhaChave).join('')}</ul>
          <p class="mut api-vazio" id="api-vazio" ${lista.length ? 'hidden' : ''}>Ainda não geraste nenhuma chave.</p>
          <p class="mut api-nota">A chave só aparece uma vez, logo depois de a gerares. Não a guardamos
            nem a conseguimos mostrar de novo: se a perderes, revoga-a e gera outra. A lista acima
            fica neste browser; para revogar noutro dispositivo, tens de usar o mesmo browser.
            Cada ligação pode ter até 5 chaves activas.</p>
        </div>`)}

      ${card('Como usar', `
        <div class="card-b api-doc">
          <p>Envia a chave no cabeçalho <code>X-API-Key</code> (ou <code>Authorization: Bearer …</code>).
            Nunca a ponhas no endereço.</p>
          <pre class="api-code"><code>curl -H "X-API-Key: a_tua_chave" \\
  ${esc(base)}/api/v1/index</code></pre>
          <dl class="api-eps">
            ${ENDPOINTS.map(([e, d]) => `<dt><code>${esc(e)}</code></dt><dd>${esc(d)}</dd>`).join('')}
          </dl>
          <p class="mut">Sem chave, ou com uma chave revogada, a resposta é 401. As datas terminam em
            <code>Z</code> mas são hora local do pavilhão: não converter fusos. Os dados só são
            actualizados quando o site é republicado; o campo <code>gerado</code> diz quando foi a
            última extracção.</p>
        </div>`)}`;
  },

  mount(root) {
    const form = root.querySelector('#api-form');
    const nome = root.querySelector('#api-nome');
    const criar = root.querySelector('#api-criar');
    const erro = root.querySelector('#api-erro');
    const nova = root.querySelector('#api-nova');
    const ul = root.querySelector('#api-lista');
    const vazio = root.querySelector('#api-vazio');

    const mostrarErro = (msg) => { erro.textContent = msg; erro.hidden = !msg; };
    const atualizarVazio = () => { vazio.hidden = lerLista().length > 0; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      mostrarErro('');
      criar.disabled = true;
      try {
        const r = await fetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nome.value }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 404 || r.status === 501) throw new Error('A gestão de chaves só funciona no site publicado, não no servidor local.');
        if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);

        gravarLista([...lerLista(), { id: d.id, nome: d.nome, criada: d.criada }]);
        ul.insertAdjacentHTML('beforeend', linhaChave(d));
        atualizarVazio();
        nome.value = '';

        // A chave só existe aqui, na memória desta página.
        nova.innerHTML = `<div class="api-nova" role="status">
          <b>Copia a chave agora — não voltará a ser mostrada.</b>
          <div class="api-nova-linha">
            <code id="api-chave-txt">${esc(d.chave)}</code>
            <button type="button" class="api-btn" id="api-copiar">Copiar</button>
          </div>
        </div>`;
        const copiar = nova.querySelector('#api-copiar');
        copiar.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(d.chave);
            copiar.textContent = 'Copiada';
          } catch {
            const sel = getSelection();
            const faixa = document.createRange();
            faixa.selectNodeContents(nova.querySelector('#api-chave-txt'));
            sel.removeAllRanges();
            sel.addRange(faixa);
            copiar.textContent = 'Seleccionada — Ctrl+C';
          }
        });
      } catch (err) {
        mostrarErro(err.message || 'Não foi possível gerar a chave.');
      } finally {
        criar.disabled = false;
      }
    });

    // Revogar em dois passos, sem diálogos do browser.
    ul.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-revogar]');
      if (!b) return;
      if (!b.dataset.confirma) {
        b.dataset.confirma = '1';
        b.textContent = 'Confirmar revogação';
        setTimeout(() => { delete b.dataset.confirma; b.textContent = 'Revogar'; }, 4000);
        return;
      }
      mostrarErro('');
      b.disabled = true;
      const id = b.dataset.revogar;
      try {
        const r = await fetch(`/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
        // 404 = já não existia no servidor; tirar da lista é o resultado certo.
        if (!r.ok && r.status !== 404) throw new Error(`Erro ${r.status}`);
        gravarLista(lerLista().filter((k) => k.id !== id));
        b.closest('.api-chave').remove();
        nova.innerHTML = '';
        atualizarVazio();
      } catch (err) {
        b.disabled = false;
        mostrarErro(`Não foi possível revogar: ${err.message}`);
      }
    });
  },
};
