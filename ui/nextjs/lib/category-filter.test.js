import { expect, test } from 'vitest';
import { categoryOptions, matchesCategory } from './category-filter';

const cat = (id, name, deleted = false) => ({ id, name, deleted });
const product = (category) => ({ category });

test('categoryOptions ignores deleted categories, removes duplicates and sorts in pt-BR', () => {
  const rooms = [
    { products: [product(cat('4', 'Outros')), product(cat('2', 'Elétrica')), product(cat('x', 'Antiga', true))] },
    { products: [product(cat('3', 'luminotécnica')), product(cat('1', 'Acústica')), product(cat('2', 'Elétrica'))] },
  ];
  expect(categoryOptions(rooms).map((o) => o.label)).toEqual(['Acústica', 'Elétrica', 'luminotécnica', 'Outros']);
  expect(categoryOptions(rooms)[0]).toEqual({ value: '1', label: 'Acústica' });
});

test('matchesCategory treats an empty id as all categories', () => {
  const item = product(cat('1', 'Acústica'));
  expect(matchesCategory(item, '')).toBe(true);
  expect(matchesCategory(item, '1')).toBe(true);
  expect(matchesCategory(item, '2')).toBe(false);
});
