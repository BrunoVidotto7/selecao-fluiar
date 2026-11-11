const CHANGE_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});
const when = (changedAt) => <time dateTime={changedAt}>{CHANGE_DATE.format(new Date(changedAt))}</time>;

export default function ClientChangeDetails({ change, product }) {
  const authors = [...new Set([change.purchase, ...(change.notes ?? [])].filter(Boolean).map((item) => item.clientName))];
  return <div className="client-change-details">
    <strong>Alterado por {authors.map((name) => name ?? 'um perfil').join(', ')}</strong>
    {change.purchase && <p>{change.purchase.clientName ?? 'Um perfil'} · {change.purchase.value ? 'Marcou como comprado' : 'Desmarcou a compra'}
      {' · '}{when(change.purchase.changedAt)}
      {change.purchase.value !== product.bought && <span> · Última alteração do perfil: {change.purchase.value ? 'comprado' : 'não comprado'}</span>}
    </p>}
    {(change.notes ?? []).map((note) => <p key={note.clientId}>{note.clientName ?? 'Um perfil'} · {note.value === null ? 'Removeu a observação' : 'Alterou a observação'}
      {' · '}{when(note.changedAt)}
    </p>)}
  </div>;
}
