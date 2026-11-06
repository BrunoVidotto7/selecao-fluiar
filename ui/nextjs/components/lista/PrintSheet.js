'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { host, formatLongDate } from '../../lib/format';
import { formatQuantity } from '../../lib/quantity';

// Paper copy: no prices, images or internal notes; links are plain text.
export default function PrintSheet({ title, clientName, rooms, selected }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || selected.size === 0) return null;
  const sections = rooms
    .map((room) => ({ room, products: room.products.filter((product) => selected.has(product.id)) }))
    .filter(({ products }) => products.length > 0);
  return createPortal(
    <div className="print-sheet">
      <h1>{title}</h1>
      {clientName && <p>Cliente: {clientName}</p>}
      <p>{formatLongDate(new Date().toISOString())}</p>
      {sections.map(({ room, products }) => (
        <section key={room.id}>
          <h2>{room.name}</h2>
          <table>
            <thead>
              <tr><th>Qtd.</th><th>Item</th><th>Links e observações</th></tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{formatQuantity(product.quantity, product.unit)}</td>
                  <td>{product.name}</td>
                  <td>
                    {(product.links ?? []).map((link, index) => (
                      <div key={index}>{host(link.url)}{link.note ? ` — ${link.note}` : ''}</div>
                    ))}
                    {product.clientNotes && <div>Observação do cliente: {product.clientNotes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>,
    document.body,
  );
}
