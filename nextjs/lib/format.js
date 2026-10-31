export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
