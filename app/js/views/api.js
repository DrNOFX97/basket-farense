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

// Prompt para colar numa LLM (Claude Code, Cursor, ChatGPT…) que esteja a
// construir outra app com estes dados. Com a chave verdadeira só existe logo
// depois de a gerar; na secção "Como usar" leva um marcador no lugar da chave.
export const MARCADOR_CHAVE = '<A_TUA_CHAVE>';

export function promptLlm(chave, base) {
  return `Vais ligar a minha app a uma API de basquetebol do SC Farense (todos os escalões). Os dados são só de leitura e vêm em JSON.

## Acesso
- Base: ${base}
- Autenticação: cabeçalho "X-API-Key: ${chave}" em todos os pedidos (também aceita "Authorization: Bearer ${chave}").
- A chave é pessoal e secreta. Nunca a ponhas no URL, em logs, em commits nem em código partilhado: guarda-a numa configuração local (num iPhone, no Keychain ou num ficheiro de configuração fora do repositório). Sem chave, ou com uma chave revogada, a resposta é 401.
- As respostas GET trazem "Cache-Control: private, max-age=300": não faças pedidos a mais de uma vez por minuto. Os dados só mudam quando o site é republicado (campo "gerado").

## Endpoints (GET)
- /api/v1/index: épocas e equipas, sem jogos. Cada equipa traz "url", o caminho do seu ficheiro completo.
- /api/v1/<época>/<equipa>: equipa completa (ex.: /api/v1/2026-2027/seniores-m).
- /api/v1/<época>/<equipa>/jogos/<fid>: um jogo com boxscore e acções.
- /api/v1/all: tudo de uma vez (~370 KB). Prefere o index e pede só o que o ecrã precisa.
- Todas as respostas têm "versao": 1. Ignora campos desconhecidos para sobreviveres a campos novos.
- Para o estado ao vivo existe /api/live (sem chave).

## Estrutura de uma equipa
id, nome, nomeCurto (ex.: "Sub 18 M A"), escalao, genero ("M"/"F"), competicao, epoca, logo (URL), gerado,
resumo {jogos, realizados, v, d, pontos, sofridos, media, mediaSofrida},
classificacao [{grupo, linhas:[{fid, nome, pos, eu, j, v, d, pm, ps, dif, ppg, oppg, logo}]}] ("eu": true marca o Farense),
plantel [{fid, nome, num, capitao, foto}],
agregado {estatísticas da equipa na época, ex.: pointsAVG, pointsConcededAVG, freeThrowsPercentage},
jogos [{fid, data, jornada, casa, fora, casaFid, foraFid, emCasa, jogado, meus, adv, resultado ("V"/"D"/null), estado, parciais [[período, casa, fora]], local, detalhe}].
"meus" e "adv" são os pontos do Farense e do adversário, independentemente de jogar em casa ou fora. Jogos por jogar têm "jogado": false e pontos a null.
Num jogo com "detalhe": true há ainda: lideranca {maiorCasa, maiorFora, empates, trocas}; jogadores {casa:[...], fora:[...]} com {fid, num, nome, min (segundos), pts, c2/f2 (2 pontos marcados/falhados), c3/f3 (3 pontos), cll/fll (lances livres marcados/falhados), ft (faltas cometidas), fr (faltas sofridas), val (valorização FIBA), pm (+/-)}; accoes [[período, tempo, fid do actor, tipo do actor, código, subcódigo, valor, resultado, fid da equipa]].

## Armadilhas
- As datas (ex.: "2026-10-24T19:30:00.000Z") terminam em Z mas são a hora LOCAL do pavilhão. Lê o dia e a hora do texto e nunca convertas fusos horários (um parser de datas normal mostra a hora errada).
- Não existem ressaltos, assistências, roubos de bola, perdas de bola nem desarmes: esses campos vêm sempre a 0. Também não há lançamentos de campo falhados (f2 e f3 vêm a 0), por isso é impossível calcular percentagem de campo e não a mostres; mostra apenas 2 pontos, 3 pontos e lances livres como marcados/tentados.
- Mostra sempre uma nota de que os dados vêm da plataforma NBN23/FPB e podem estar incompletos.
- Trata 401 (chave inválida ou revogada), falhas de rede e listas vazias com mensagens claras. Os nomes vêm em UTF-8 com acentos.

## O que quero
Implementa o cliente (modelos, pedido autenticado, tratamento de erros, cache local) e o que eu pedir a seguir na app. Antes de escrever código, diz-me em que ficheiro vais pôr a chave e confirma que não vai para o controlo de versões.`;
}

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
          <details class="api-prompt">
            <summary>Prompt para uma LLM (usar estes dados noutra app)</summary>
            <p class="mut">Cola isto no Claude Code, Cursor ou ChatGPT a trabalhar na outra app. Troca
              <code>${MARCADOR_CHAVE.replace('<', '&lt;').replace('>', '&gt;')}</code> pela tua chave, ou gera uma
              chave acima e usa o botão "Copiar prompt com a chave".</p>
            <pre class="api-code"><code>${esc(promptLlm(MARCADOR_CHAVE, base))}</code></pre>
            <button type="button" class="api-btn" id="api-copiar-modelo">Copiar prompt</button>
          </details>
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

    // Copia para a área de transferência; sem permissão, selecciona o texto.
    const copiarTexto = async (btn, texto, alvo, rotulo) => {
      try {
        await navigator.clipboard.writeText(texto);
        btn.textContent = 'Copiado';
      } catch {
        const sel = getSelection();
        const faixa = document.createRange();
        faixa.selectNodeContents(alvo);
        sel.removeAllRanges();
        sel.addRange(faixa);
        btn.textContent = 'Seleccionado — Ctrl+C';
      }
      setTimeout(() => { btn.textContent = rotulo; }, 2500);
    };

    const modelo = root.querySelector('#api-copiar-modelo');
    modelo.addEventListener('click', () => copiarTexto(
      modelo, promptLlm(MARCADOR_CHAVE, location.origin), root.querySelector('.api-prompt pre code'), 'Copiar prompt'));

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
            <button type="button" class="api-btn" id="api-copiar">Copiar chave</button>
          </div>
          <div class="api-nova-linha api-nova-prompt">
            <span>Para usar noutra app com uma LLM, copia o prompt já com esta chave.</span>
            <button type="button" class="api-btn api-btn-prim" id="api-copiar-prompt">Copiar prompt com a chave</button>
          </div>
        </div>`;
        const chaveTxt = nova.querySelector('#api-chave-txt');
        const bChave = nova.querySelector('#api-copiar');
        bChave.addEventListener('click', () => copiarTexto(bChave, d.chave, chaveTxt, 'Copiar chave'));
        const bPrompt = nova.querySelector('#api-copiar-prompt');
        bPrompt.addEventListener('click', () => copiarTexto(
          bPrompt, promptLlm(d.chave, location.origin), chaveTxt, 'Copiar prompt com a chave'));
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
