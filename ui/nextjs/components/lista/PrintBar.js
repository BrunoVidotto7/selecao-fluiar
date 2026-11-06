'use client';

import Button from '../ui/Button';
import { plural } from '../../lib/format';

export default function PrintBar({ count, onPrint, onClear }) {
  if (count === 0) return null;
  return (
    <div className="print-bar">
      <span role="status">{plural(count, 'item selecionado', 'itens selecionados')}</span>
      <div className="print-bar-actions">
        <Button variant="ghost" onClick={onClear}>Limpar</Button>
        <Button onClick={onPrint}>Imprimir selecionados</Button>
      </div>
    </div>
  );
}
