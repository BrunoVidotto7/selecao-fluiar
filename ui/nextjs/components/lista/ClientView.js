import { formatQuantity } from '@/lib/quantity';
import ItemLinks from './ItemLinks';
import ProductThumb from './ProductThumb';
import ProfileNotes from './ProfileNotes';
import { priceText } from '@/lib/format';

// Client preview without purchase controls, with print selection.
/**
 * @param {{ rooms: { id?: string, name: string, products: { id?: string, name: string, quantity: number, unit?: string, bought: boolean, imageUrl: string | null, category: { name: string }, clientNotes: { clientId: string, clientName: string, text: string }[], unitPrice?: number | null, notes?: string | null, links: { url: string, note: string | null }[] }[] }[],
 *   selected: Set<string>, onSelect: (id: string) => void, onSelectRoom: (room: object) => void, isRoomSelected: (room: object) => boolean }} props
 */
export default function ClientView({ rooms, selected, onSelect, onSelectRoom, isRoomSelected }) {
  return rooms.filter((r) => r.products.length).map((r, roomIndex) => (
    <div key={r.id ?? roomIndex}>
      <h2>{r.name}</h2>
      <div className="tbl view">
        <table>
          <thead><tr><th className="pr"><input type="checkbox" className="check" checked={isRoomSelected(r)}
            onChange={() => onSelectRoom(r)} aria-label={`Selecionar todos de ${r.name}`} /></th><th className="ck" aria-label="Comprado">✓</th><th className="qt">Qtd.</th><th className="it">Item</th><th>Opções e observações</th></tr></thead>
          <tbody>
            {r.products.map((it, productIndex) => (
              <tr key={it.id ?? productIndex} className={it.bought ? 'done' : ''}>
                <td className="pr"><input type="checkbox" className="check" checked={selected.has(it.id)}
                  onChange={() => onSelect(it.id)} aria-label={`Imprimir: ${it.name}`} /></td>
                <td className="ck"><span className={'mark ' + (it.bought ? 'on' : 'off')} role="img" aria-label={it.bought ? 'Comprado' : 'Ainda não comprado'} /></td>
                <td className="qt"><span className="ro-qty">{formatQuantity(it.quantity, it.unit)}</span></td>
                <td className="it"><div className="itm">
                  <ProductThumb imageUrl={it.imageUrl} />
                  <div className="txt"><span className="ro-name">{it.name}</span><span className="ro-cat">{it.category.name}</span>
                    <span className="price">{priceText(it)}</span></div>
                </div></td>
                <td><ItemLinks links={it.links} empty="Opções em breve" />
                  {it.notes && <p className="meta"><b>Nota interna:</b> {it.notes}</p>}
                  <ProfileNotes notes={it.clientNotes} productName={it.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ));
}
