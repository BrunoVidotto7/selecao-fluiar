import { parseBRL } from '@/lib/format';
import { validateField } from '@/lib/validation';

const MAX_LINKS = 10;
const URL_MAX_LENGTH = 2048;
const LINK_NOTE_MAX_LENGTH = 200;
const LINK_REQUIRED = 'Cole o link completo, começando com https://';
const LINKS_TOO_MANY = 'Adicione no máximo 10 links.';

const filledLinks = (values) => values.links.filter((link) => link.url.trim() || link.note.trim());

/** @param {{ nome: string, amb: string, qtd: string, preco: string, obs: string, bought: boolean, links: { id: string, url: string, note: string }[] }} values */
export function toProductRequest(values) {
  return {
    name: values.nome.trim(),
    roomId: values.amb,
    quantity: Number(values.qtd),
    unitPrice: values.preco.trim() ? parseBRL(values.preco.trim()) : null,
    notes: values.obs.trim() || null,
    bought: values.bought,
    links: filledLinks(values).map((link) => ({ url: link.url.trim(), note: link.note.trim() || null })),
  };
}

export function validateProductLinks(values) {
  const links = filledLinks(values);
  const errors = {};
  if (links.length > MAX_LINKS) errors.links = LINKS_TOO_MANY;

  for (const link of links) {
    const urlError = validateField('url', link, { required: LINK_REQUIRED, url: true, maxLength: URL_MAX_LENGTH });
    const noteError = validateField('note', link, { maxLength: LINK_NOTE_MAX_LENGTH });
    if (urlError) errors[`link-${link.id}-url`] = urlError;
    if (noteError) errors[`link-${link.id}-note`] = noteError;
  }
  return errors;
}

export function productFieldMap(values) {
  const fields = { name: 'nome', roomId: 'amb', quantity: 'qtd', unitPrice: 'preco', notes: 'obs', bought: 'bought', links: 'links' };
  filledLinks(values).forEach((link, index) => {
    fields[`links[${index}].url`] = `link-${link.id}-url`;
    fields[`links[${index}].note`] = `link-${link.id}-note`;
  });
  return fields;
}
