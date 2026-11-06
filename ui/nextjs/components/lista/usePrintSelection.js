'use client';

import { useCallback, useEffect, useState } from 'react';

const ids = (rooms) => new Set(rooms.flatMap((room) => room.products.map((product) => product.id)));

// Print selection by product id; ids of products that left the list are dropped.
export default function usePrintSelection(rooms) {
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    const existing = ids(rooms);
    setSelected((current) => {
      const kept = new Set([...current].filter((id) => existing.has(id)));
      return kept.size === current.size ? current : kept;
    });
  }, [rooms]);

  const toggle = useCallback((id) => setSelected((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  }), []);

  const isRoomSelected = (room) => room.products.length > 0 && room.products.every((product) => selected.has(product.id));

  const toggleRoom = (room) => setSelected((current) => {
    const next = new Set(current);
    const all = room.products.length > 0 && room.products.every((product) => current.has(product.id));
    room.products.forEach((product) => (all ? next.delete(product.id) : next.add(product.id)));
    return next;
  });

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, toggleRoom, isRoomSelected, clear };
}
