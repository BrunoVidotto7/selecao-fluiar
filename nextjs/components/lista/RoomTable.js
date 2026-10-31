'use client';
// Tabela de um ambiente no modo edição (colunas da página original: ✓ | Qtd. | Item | Links e observações)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icon';
import { brl } from '@/lib/format';
import ItemLinks from './ItemLinks';

const priceText = (it) => (it.price == null ? 'Sem preço' : (it.qty || 1) > 1 ? `${it.qty} × ${brl(it.price)}` : brl(it.price));

export default function RoomTable({ room, items, showAdd, listBase, onToggle, onQty, onRemove }) {
  const done = room.items.filter((i) => i.bought).length;
  return (
    <>
      <div className="roomhead"><h2>{room.name}</h2><span>{done} de {room.items.length} comprados</span></div>
      <div className="tbl">
        <table>
          <thead><tr><th className="ck" aria-label="Comprado">✓</th><th className="qt">Qtd.</th><th className="it">Item</th><th>Links e observações</th></tr></thead>
          <tbody>
            {items.map((it) => <ItemRow key={it.id} item={it} listBase={listBase} onToggle={onToggle} onQty={onQty} onRemove={onRemove} />)}
            {showAdd && (
              <tr className="new"><td className="ck" /><td colSpan={3}>
                <Link className="newlink" href={`${listBase}/produtos/novo?ambiente=${encodeURIComponent(room.name)}`}><Icon name="plus" />novo item em {room.name}</Link>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ItemRow({ item, listBase, onToggle, onQty, onRemove }) {
  const [qty, setQty] = useState(String(item.qty || ''));
  const [armed, setArmed] = useState(false); // remoção em dois toques, como na página original
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 2500); return () => clearTimeout(t); }, [armed]);
  const editHref = `${listBase}/produtos/${item.id}/editar`;
  const commitQty = () => { const v = +qty >= 1 ? +qty : 1; setQty(String(v)); if (v !== item.qty) onQty(item.id, v); };

  return (
    <tr className={item.bought ? 'done' : ''}>
      <td className="ck"><input type="checkbox" className="check" checked={item.bought} onChange={(e) => onToggle(item.id, e.target.checked)} aria-label={`Comprado: ${item.name}`} /></td>
      <td className="qt">
        <input type="number" min="1" inputMode="numeric" className="qty" value={qty} placeholder="1" aria-label="Quantidade"
          onChange={(e) => setQty(e.target.value)} onBlur={commitQty} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      </td>
      <td className="it">
        <div className="itm">
          <span className="thumb">{item.image ? <img src={item.image} alt="" /> : <Icon name="bag" />}</span>
          <div className="txt">
            <div className="nmw">
              <Link className="nm-link" href={editHref}>{item.name}</Link>
              <Link className="ed" href={editHref} aria-label={`Editar ${item.name}`}><Icon name="edit" /></Link>
              <button type="button" className={'del' + (armed ? ' armed' : '')} aria-label={armed ? `Confirmar remoção de ${item.name}` : `Remover ${item.name}`}
                onClick={() => (armed ? onRemove(item.id) : setArmed(true))}>{armed ? 'remover?' : '×'}</button>
            </div>
            <span className="price">{priceText(item)}</span>
          </div>
        </div>
      </td>
      <td><ItemLinks links={item.links} empty="Sem links ainda" /></td>
    </tr>
  );
}
