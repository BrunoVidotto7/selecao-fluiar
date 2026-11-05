const CHANGE_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});

export default function ClientChangeDetails({ change, product }) {
  return <div className="client-change-details">
    <strong>Alterado pelo cliente</strong>
    {change.purchase && <p>{change.purchase.value ? 'Marcou como comprado' : 'Desmarcou a compra'}
      {' · '}<time dateTime={change.purchase.changedAt}>{CHANGE_DATE.format(new Date(change.purchase.changedAt))}</time>
      {change.purchase.value !== product.bought && <span> · Última alteração do cliente: {change.purchase.value ? 'comprado' : 'não comprado'}</span>}
    </p>}
    {change.notes && <p>{change.notes.value === null ? 'Removeu a observação' : 'Alterou a observação'}
      {' · '}<time dateTime={change.notes.changedAt}>{CHANGE_DATE.format(new Date(change.notes.changedAt))}</time>
      {change.notes.value !== product.clientNotes && <span> · Última alteração do cliente: {change.notes.value ?? 'observação removida'}</span>}
    </p>}
  </div>;
}
