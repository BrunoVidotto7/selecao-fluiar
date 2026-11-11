import { isUuid } from './route-input';
import { formatQuantity } from './quantity';
export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const priceText = (it) => (it.unitPrice == null ? 'Sem preço' : it.quantity !== 1 ? `${formatQuantity(it.quantity, it.unit)} × ${brl(it.unitPrice)}` : brl(it.unitPrice));
export const pct = (total, done) => (total ? Math.round((100 * done) / total) : 0);
export const initials = (name) => {
  const w = name.replace(/\b(e|de|da|do|dos|das)\b/gi, ' ').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : w[0]?.[1] || '')).toUpperCase();
};
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'link'; } };
export const parseBRL = (s) => parseFloat(String(s || '0').replace(/\./g, '').replace(',', '.')) || 0;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// "Lista de compras da casa" -> ["Lista de compras", "da casa"] (parte em destaque no título)
export const splitTitle = (v) => {
  const m = v.match(/^(.*?)(\s(?:da|do|de|das|dos|para)\s.+)$/i);
  return m ? [m[1], m[2].trim()] : [v, ''];
};
export const maskPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 7) return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
};

const TIME_ZONE = 'America/Sao_Paulo';
const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });
const LONG_DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
const CALENDAR_DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function shortDate(date, includeYear) {
  return SHORT_DATE.formatToParts(date)
    .filter(({ type }) => type === 'day' || type === 'month' || (includeYear && type === 'year'))
    .map(({ value }) => value.replace(/\.$/, ''))
    .join(' ');
}

function calendarDay(date) {
  const parts = Object.fromEntries(CALENDAR_DATE.formatToParts(date).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

export const formatShortDate = (iso) => shortDate(new Date(iso), true);
export const formatLongDate = (iso) => LONG_DATE.format(new Date(iso));
export function formatUpdatedAt(iso, now = new Date()) {
  const date = new Date(iso);
  const daysAgo = (calendarDay(now) - calendarDay(date)) / DAY_MS;
  if (daysAgo === 0) return `Hoje, ${TIME.format(date)}`;
  if (daysAgo === 1) return 'Ontem';
  return shortDate(date, false);
}

export const imageSource = (imageUrl) => {
  const match = typeof imageUrl === 'string' ? imageUrl.match(/^\/api\/images\/([0-9a-f-]+)$/i) : null;
  return match && isUuid(match[1]) ? `/images/${match[1]}` : null;
};
