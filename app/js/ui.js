// Peças de interface reutilizadas pelas vistas.

export function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function pill(res) {
  if (res === 'V') return '<span class="pill pill-v" title="Vitória">V</span>';
  if (res === 'D') return '<span class="pill pill-d" title="Derrota">D</span>';
  return '<span class="pill pill-n" title="Por jogar">—</span>';
}

export function vazio(titulo, texto) {
  return `<div class="empty"><b>${esc(titulo)}</b>${texto ? esc(texto) : ''}</div>`;
}

export function card(titulo, corpo, lado = '') {
  return `<section class="card">
    ${titulo ? `<div class="card-h"><h2>${esc(titulo)}</h2>${lado}</div>` : ''}
    ${corpo}
  </section>`;
}

export function chip(k, v) {
  return `<div class="chip"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
}

export function registo(v, d) {
  if (!v && !d) return '0-0';
  const cls = v > d ? 'v' : v < d ? 'd' : '';
  return `<span class="rec ${cls}">${v}-${d}</span>`;
}

// Barra comparativa de dois valores. Devolve HTML.
export function barra(a, b) {
  const total = (a || 0) + (b || 0);
  const pa = total ? (a / total) * 100 : 50;
  return `<div class="cmp-track" role="img" aria-label="${a} contra ${b}">
    <i class="a" style="width:${pa.toFixed(1)}%"></i>
    <i class="b" style="width:${(100 - pa).toFixed(1)}%"></i>
  </div>`;
}

export function linhaCmp(rotulo, a, b, fmt = (x) => x) {
  return `<div class="cmp-row">
    <div class="l">${fmt(a)}</div>
    ${barra(a, b)}
    <div class="r">${fmt(b)}</div>
    <div class="k" style="grid-column:1/-1;margin-top:-6px">${esc(rotulo)}</div>
  </div>`;
}

export function mmssOuTraco(v) {
  return v === null || v === undefined ? '—' : v;
}

export function tabela(cabecalho, linhas, cls = '') {
  return `<div class="tw"><table class="${cls}">
    <thead><tr>${cabecalho.map((c) => `<th scope="col"${c.num ? ' class="num"' : ''}>${c.titulo}</th>`).join('')}</tr></thead>
    <tbody>${linhas.join('')}</tbody>
  </table></div>`;
}
