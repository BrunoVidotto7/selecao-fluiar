import ItemLinks from './ItemLinks';

// Visão do cliente: reprodução fiel da página original (somente leitura)
/** @param {{ rooms: { id?: string, name: string, products: { id?: string, name: string, quantity: number, bought: boolean, links: { url: string, note: string | null }[] }[] }[] }} props */
export default function ClientView({ rooms }) {
  return rooms.filter((r) => r.products.length).map((r, roomIndex) => (
    <div key={r.id ?? roomIndex}>
      <h2>{r.name}</h2>
      <div className="tbl view">
        <table>
          <thead><tr><th className="ck" aria-label="Comprado">✓</th><th className="qt">Qtd.</th><th className="it">Item</th><th>Opções e observações</th></tr></thead>
          <tbody>
            {r.products.map((it, productIndex) => (
              <tr key={it.id ?? productIndex} className={it.bought ? 'done' : ''}>
                <td className="ck"><span className={'mark ' + (it.bought ? 'on' : 'off')} role="img" aria-label={it.bought ? 'Comprado' : 'Ainda não comprado'} /></td>
                <td className="qt"><span className="ro-qty">{it.quantity}</span></td>
                <td className="it"><span className="ro-name">{it.name}</span></td>
                <td><ItemLinks links={it.links} empty="Opções em breve" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ));
}
