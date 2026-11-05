const STORE_LABELS = { moveca: 'Moveca', 'fonte-do-sofa': 'Fonte do Sofá', westwing: 'Westwing', 'abra-casa': 'Abra Casa', casavee: 'Casavee' };
const STATUS_LABELS = { ok: 'Atualizado', partial: 'Atualização parcial', failed: 'Falha na atualização', pending: 'Aguardando atualização' };

export default function StoreSyncStatus({ sync }) {
  if (!sync) return null;
  return <div>
    <a href={sync.sourceUrl} target="_blank" rel="noopener noreferrer">Origem: {STORE_LABELS[sync.store] || sync.store}</a>
    <p>{sync.enabled ? STATUS_LABELS[sync.status] || 'Aguardando atualização' : 'Atualização automática desativada'}</p>
    {sync.lastSyncedAt && <p>Última atualização completa: {new Date(sync.lastSyncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}
  </div>;
}
