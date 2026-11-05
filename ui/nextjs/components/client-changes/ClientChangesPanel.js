'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { plural } from '@/lib/format';

const CHANGE_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});
const CATEGORIES = [
  ['purchaseMarkedCount', 'compra marcada', 'compras marcadas'],
  ['purchaseUnmarkedCount', 'compra desmarcada', 'compras desmarcadas'],
  ['notesChangedCount', 'observação alterada', 'observações alteradas'],
  ['notesRemovedCount', 'observação removida', 'observações removidas'],
];

export default function ClientChangesPanel({ result }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <section className="card client-changes-panel" aria-labelledby="client-changes-title">
    <div className="card-head"><h2 id="client-changes-title" className="sec">Alterações dos clientes</h2>
      {result.ok && <span>{plural(result.data.pendingListCount, 'lista com novidades', 'listas com novidades')}</span>}
    </div>
    {!result.ok ? <div className="client-changes-message">
      <p role="alert">{result.detail}</p>
      <button type="button" className="btn btn-ghost" disabled={pending}
        onClick={() => startTransition(() => router.refresh())}>Tentar novamente</button>
    </div> : <>
      {result.data.items.length ? <ul className="rows">{result.data.items.map((item) => <li key={item.listId} className="client-change-summary">
        <div><strong>{item.clientName}</strong><p>{item.listName}</p>
          <p>{plural(item.changedProductCount, 'produto alterado', 'produtos alterados')}</p>
          <ul className="client-change-types">{CATEGORIES.filter(([key]) => item[key] > 0).map(([key, one, many]) =>
            <li key={key}>{plural(item[key], one, many)}</li>)}</ul>
          <time dateTime={item.lastChangedAt}>{CHANGE_DATE.format(new Date(item.lastChangedAt))}</time>
        </div>
        <Link className="btn btn-ghost" href={`/listas/${item.listId}`}>Abrir lista</Link>
      </li>)}</ul> : <p className="client-changes-message">{result.data.pendingListCount === 0
        ? 'Tudo em dia! Você já viu as alterações dos seus clientes.'
        : 'Não há alterações nesta página.'}</p>}
      {(result.data.page > 0 || (result.data.page + 1) * result.data.pageSize < result.data.pendingListCount) &&
        <nav aria-label="Páginas de alterações dos clientes" className="client-changes-pagination">
          {result.data.page > 0 && <><Link href="/dashboard">Primeira página</Link>
            <Link href={`/dashboard?changesPage=${result.data.page - 1}`}>Anterior</Link></>}
          <span>Página {result.data.page + 1}</span>
          {(result.data.page + 1) * result.data.pageSize < result.data.pendingListCount &&
            <Link href={`/dashboard?changesPage=${result.data.page + 1}`}>Próxima</Link>}
        </nav>}
    </>}
  </section>;
}
