'use client';
// Administrative room table with purchase tracking and client observations.
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import Link from 'next/link';
import Icon from '../ui/Icon';
import { priceText } from '@/lib/format';
import ProductThumb from './ProductThumb';
import ClientChangeDetails from '../client-changes/ClientChangeDetails';
import ItemLinks from './ItemLinks';
import StoreSyncStatus from '../produtos/StoreSyncStatus';
import ProfileNotes from './ProfileNotes';
import { validateQuantity } from '@/lib/validation';
import { formatQuantity, parseQuantity } from '@/lib/quantity';

const REMOVE_CONFIRMATION_MS = 2500;
const UNIT_LABEL = { UNIT: 'un.', SQUARE_METER: 'm²' };
const quantityText = (quantity) => formatQuantity(quantity).split(' ')[0];

/** @param {{ room: import('../listas/queries.server').RoomResponse, products: import('../listas/queries.server').ProductResponse[],
 * showAdd: boolean, listBase: string, pendingIds: Set<string>,
 * onToggle: (id: string, bought: boolean) => Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').ProductResponse>>,
 * onQty: (id: string, quantity: number) => Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').ProductResponse>>,
 * onRemove: (id: string) => Promise<import('@/lib/api.server').ActionResult<undefined>> }} props */
export default function RoomTable({ room, products, showAdd, listBase, pendingIds, onToggle, onQty, onRemove, onDeleteNote, changesByProduct,
  selected = new Set(), onSelect, onSelectRoom, roomSelected = false }) {
  const done = room.products.filter((i) => i.bought).length;
  return (
    <>
      <div className="roomhead"><h2>{room.name}</h2><span>{done} de {room.products.length} comprados</span></div>
      <div className="tbl">
        <table>
          <thead><tr><th className="pr"><input type="checkbox" className="check" checked={roomSelected}
            onChange={onSelectRoom} aria-label={`Selecionar todos de ${room.name}`} /></th><th className="ck" aria-label="Comprado">✓</th><th className="qt">Qtd.</th><th className="it">Item</th><th>Links e observações</th></tr></thead>
          <tbody>
            {products.map((it) => <ItemRow key={`${listBase}:${it.id}`} item={it} listBase={listBase}
              change={changesByProduct?.get(it.id)} pending={pendingIds.has(it.id)} printed={selected.has(it.id)} onPrint={onSelect} onToggle={onToggle} onQty={onQty} onRemove={onRemove} onDeleteNote={onDeleteNote} />)}
            {showAdd && (
              <tr className="new"><td className="ck" /><td colSpan={4}>
                <Link className="newlink" href={`${listBase}/produtos/novo?ambiente=${room.id}`}><Icon name="plus" />novo item em {room.name}</Link>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ItemRow({ item, listBase, pending, printed, onPrint, onToggle, onQty, onRemove, onDeleteNote, change }) {
  const [quantityDraft, setQuantityDraft] = useState({ value: null, error: '' });
  const currentDraft = useRef(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const armedRef = useRef(false);
  const [armed, setArmed] = useState(false); // Two-tap removal confirmation.
  const armRemoval = (value) => { armedRef.current = value; setArmed(value); };
  const updateDraft = (value, error = '') => {
    currentDraft.current = value;
    setQuantityDraft({ value, error });
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    currentDraft.current = null;
    setQuantityDraft({ value: null, error: '' });
  }, [item.quantity]);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => {
      armedRef.current = false;
      setArmed(false);
    }, REMOVE_CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const editHref = `${listBase}/produtos/${item.id}/editar`;
  const errorId = `quantity-${item.id}-err`;
  const { error } = quantityDraft;
  const qty = quantityDraft.value ?? quantityText(item.quantity);

  const mutate = async (write, onResult) => {
    if (pending || inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await write();
      if (mounted.current) onResult?.(result);
      return result;
    } catch (failure) {
      if (!mounted.current) return;
      unstable_rethrow(failure);
      onResult?.(null);
    } finally {
      inFlight.current = false;
    }
  };

  const validateQuantityDraft = () => {
    const value = currentDraft.current ?? quantityText(item.quantity);
    const message = validateQuantity(value, item.unit);
    setQuantityDraft((previous) => ({ ...previous, error: message }));
    return message ? null : parseQuantity(value);
  };

  const commitQty = () => {
    if (pending || inFlight.current) return;
    const quantity = validateQuantityDraft();
    if (quantity === null || quantity === item.quantity) return;

    return mutate(() => onQty(item.id, quantity), (result) => {
      updateDraft(null, result && !result.ok ? result.errors.quantity || '' : '');
    });
  };

  const toggle = (bought) => {
    if (pending || inFlight.current) return;
    if (bought) {
      const quantity = validateQuantityDraft();
      if (quantity === null) return;
      if (quantity !== item.quantity) return commitQty();
    }
    return mutate(() => onToggle(item.id, bought));
  };

  const remove = () => {
    if (pending || inFlight.current) return;
    if (!armedRef.current) { armRemoval(true); return; }
    armRemoval(false);
    return mutate(() => onRemove(item.id));
  };

  return (
    <tr className={[item.bought ? 'done' : '', change ? 'client-changed' : ''].filter(Boolean).join(' ')}>
      <td className="pr"><input type="checkbox" className="check" checked={printed}
        onChange={() => onPrint(item.id)} aria-label={`Imprimir: ${item.name}`} /></td>
      <td className="ck"><input type="checkbox" className="check" disabled={pending} checked={item.bought}
        onChange={(e) => toggle(e.target.checked)} aria-label={`Comprado: ${item.name}`} /></td>
      <td className="qt">
        <input type="text" inputMode="decimal" className="qty"
          disabled={pending} value={qty} placeholder="1" aria-label="Quantidade"
          aria-invalid={error ? 'true' : 'false'} aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            if (pending || inFlight.current) return;
            updateDraft(e.target.value);
          }} onBlur={commitQty} onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitQty(); e.currentTarget.blur(); }
          }} />
        <span className="qty-unit">{UNIT_LABEL[item.unit] ?? UNIT_LABEL.UNIT}</span>
        {error && <p className="errmsg" id={errorId}>{error}</p>}
      </td>
      <td className="it">
        <div className="itm">
          <ProductThumb imageUrl={item.imageUrl} />
          <div className="txt">
            <div className="nmw">
              <Link className="nm-link" href={editHref}>{item.name}</Link>
              <Link className="ed" href={editHref} aria-label={`Editar ${item.name}`}><Icon name="edit" /></Link>
              <button type="button" className={'del' + (armed ? ' armed' : '')} disabled={pending}
                aria-label={armed ? `Confirmar remoção de ${item.name}` : `Remover ${item.name}`}
                onClick={remove}>{armed ? 'remover?' : '×'}</button>
            </div>
            <span className="ro-cat">{item.category.name}</span>
            <span className="price">{priceText(item)}</span>
            <StoreSyncStatus sync={item.storeSync} />
          </div>
        </div>
      </td>
      <td><ItemLinks links={item.links} empty="Sem links ainda" />
        {change && <ClientChangeDetails change={change} product={item} />}
        <ProfileNotes notes={item.clientNotes} productName={item.name} pending={pending}
          onDelete={(clientId) => mutate(() => onDeleteNote(item.id, clientId))} />
      </td>
    </tr>
  );
}
