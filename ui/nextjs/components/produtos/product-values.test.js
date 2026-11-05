import { expect, test } from 'vitest';
import { toProductRequest, validateProductLinks, productFieldMap } from './product-values';
import { ROOM } from '@/test-support/fixtures';

const values = {
  nome: ' Batedeira ', amb: ROOM.id, qtd: '2', preco: '0,00', obs: '', bought: false,
  links: [{ id: 'row0', url: '', note: '' }, { id: 'row1', url: ' https://loja.com/item ', note: ' Azul ' }],
};

test('payloads preserve zero and omit only entirely blank link rows', () => {
  expect(toProductRequest(values)).toEqual({
    name: 'Batedeira', roomId: ROOM.id, quantity: 2, unitPrice: 0, notes: null, bought: false,
    links: [{ url: 'https://loja.com/item', note: 'Azul' }],
  });
  expect(toProductRequest({ ...values, preco: '' }).unitPrice).toBeNull();
  expect(toProductRequest({ ...values, preco: '1.234,56', obs: ' Medidas ', bought: true,
    links: [{ id: 'row7', url: 'https://loja.com', note: ' ' }] })).toEqual({
    name: 'Batedeira', roomId: ROOM.id, quantity: 2, unitPrice: 1234.56, notes: 'Medidas', bought: true,
    links: [{ url: 'https://loja.com', note: null }],
  });
});

test('API indices map to stable visible IDs after blank rows are filtered', () => {
  expect(productFieldMap(values)).toMatchObject({
    name: 'nome', roomId: 'amb', quantity: 'qtd', unitPrice: 'preco', notes: 'obs',
    'links[0].url': 'link-row1-url', 'links[0].note': 'link-row1-note',
  });
  expect(productFieldMap({ ...values, links: [values.links[1], { id: 'row8', url: 'https://loja.com/2', note: '' }] })['links[1].url'])
    .toBe('link-row8-url');
});

test('blank rows are allowed but note-only and invalid URLs attach errors to their own inputs', () => {
  expect(validateProductLinks({ links: [{ id: 'row0', url: ' ', note: ' ' }] })).toEqual({});
  expect(validateProductLinks({ links: [
    { id: 'row3', url: '', note: 'Azul' },
    { id: 'row5', url: 'https://loja.com oferta', note: '' },
  ] })).toEqual({
    'link-row3-url': 'Cole o link completo, começando com https://',
    'link-row5-url': 'Cole o link completo, começando com https://',
  });
});

test('link URL and note length boundaries are validated before sending', () => {
  const url = 'https://loja.com/' + 'x'.repeat(2031);
  expect(validateProductLinks({ links: [{ id: 'row0', url, note: 'n'.repeat(200) }] })).toEqual({});
  expect(validateProductLinks({ links: [{ id: 'row0', url: url + 'x', note: 'n'.repeat(201) }] })).toEqual({
    'link-row0-url': 'Use no máximo 2048 caracteres.',
    'link-row0-note': 'Use no máximo 200 caracteres.',
  });
});

test('the ten-link limit counts only filled rows', () => {
  const links = Array.from({ length: 10 }, (_, i) => ({ id: `row${i}`, url: 'https://loja.com', note: '' }));
  expect(validateProductLinks({ links: [...links, { id: 'blank', url: '', note: '' }] })).toEqual({});
  expect(validateProductLinks({ links: [...links, { id: 'extra', url: '', note: 'Azul' }] }).links)
    .toBe('Adicione no máximo 10 links.');
});

test('payloads carry the chosen category', () => {
  expect(toProductRequest({ ...values, categoryId: 'c1' }).categoryId).toBe('c1');
  expect(productFieldMap(values).categoryId).toBe('categoryId');
});
