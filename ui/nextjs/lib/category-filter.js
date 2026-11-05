import { useState } from 'react';

/** Non-deleted categories present in the products of `rooms`, unique and sorted. */
export function categoryOptions(rooms) {
  const byId = new Map();
  for (const room of rooms) {
    for (const product of room.products) {
      const { id, name, deleted } = product.category;
      if (!deleted) byId.set(id, { value: id, label: name });
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
}

export const matchesCategory = (product, categoryId) => !categoryId || product.category.id === categoryId;

/** Category filter state; a selection that left the options falls back to all ('') when rendering. */
export function useCategoryFilter(rooms) {
  const [selected, setSelected] = useState('');
  const options = categoryOptions(rooms);
  const categoryId = options.some((o) => o.value === selected) ? selected : '';
  return [categoryId, setSelected, options];
}
