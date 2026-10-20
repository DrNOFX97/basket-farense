// Formatação de datas, horas e números.
// As datas da API vêm com sufixo Z mas representam a hora local do pavilhão.
// Lemos os componentes do texto e nunca convertemos de fuso, para não deslocar
// os jogos uma hora.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso || '');
  if (!m) return null;
  return { a: +m[1], m: +m[2] - 1, d: +m[3], h: m[4] ? +m[4] : null, mi: m[5] ? +m[5] : null };
}

export function dia(iso) {
  const p = partes(iso);
  return p ? String(p.d).padStart(2, '0') : '—';
}

export function mes(iso) {
  const p = partes(iso);
  return p ? MESES[p.m] : '';
}

export function dataCurta(iso) {
  const p = partes(iso);
  return p ? `${p.d} ${MESES[p.m]}` : '—';
}

export function hora(iso) {
  const p = partes(iso);
  return p && p.h !== null ? `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}` : '';
}

export function dataLonga(iso) {
  const p = partes(iso);
  if (!p) return 'Data a confirmar';
  const d = new Date(p.a, p.m, p.d);
  const h = hora(iso);
  return `${DIAS[d.getDay()]}, ${p.d} de ${MESES_L[p.m]}${h ? ' · ' + h : ''}`;
}

export function chaveMes(iso) {
  const p = partes(iso);
  return p ? `${p.a}-${String(p.m + 1).padStart(2, '0')}` : '0000-00';
}

export function nomeMes(iso) {
  const p = partes(iso);
  return p ? `${MESES_L[p.m]} ${p.a}` : '';
}

export function mmss(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// O relógio do jogo e as acções vêm em milissegundos.
export function relogio(v) {
  if (!v && v !== 0) return '';
  const ms = v > 36000 ? v : v * 1000;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function pct(feitos, tentados) {
  if (!tentados) return null;
  return Math.round((feitos / tentados) * 100);
}

export function num(v, dec = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-PT', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}

export function quando(iso) {
  const p = partes(iso);
  if (!p || p.h === null) return '';
  const alvo = new Date(p.a, p.m, p.d, p.h, p.mi);
  const dif = alvo.getTime() - Date.now();
  const min = Math.round(dif / 60000);

  if (min < -180) return '';
  if (min < 0) return 'a decorrer';
  if (min < 60) return `dentro de ${Math.max(1, min)} min`;

  const dias = Math.round(dif / 86400000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias < 7) return `em ${dias} dias`;
  return '';
}

export function idadeJogo(iso) {
  const p = partes(iso);
  if (!p) return Infinity;
  return Math.abs(Date.now() - new Date(p.a, p.m, p.d, p.h || 0, p.mi || 0).getTime());
}
