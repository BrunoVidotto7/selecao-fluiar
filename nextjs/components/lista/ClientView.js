import ItemLinks from './ItemLinks';

// Visão do cliente: reprodução fiel da página original (somente leitura)
export default function ClientView({ rooms }) {
  return rooms.filter((r) => r.items.length).map((r) => (
    <div key={r.name}>
      <h2>{r.name}</h2>
      <div className="tbl view">
        <table>
          <thead><tr><th className="ck" aria-label="Comprado">✓</th><th className="qt">Qtd.</th><th className="it">Item</th><th>Opções e observações</th></tr></thead>
          <tbody>
            {r.items.map((it) => (
              <tr key={it.id} className={it.bought ? 'done' : ''}>
                <td className="ck"><span className={'mark ' + (it.bought ? 'on' : 'off')} role="img" aria-label={it.bought ? 'Comprado' : 'Ainda não comprado'} /></td>
                <td className="qt"><span className="ro-qty">{it.qty || 1}</span></td>
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
