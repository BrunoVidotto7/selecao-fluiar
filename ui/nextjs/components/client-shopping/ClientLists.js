import Link from 'next/link';
import { EmptyState, Progress, StatusBadge } from '../ui/Display';
import Button from '../ui/Button';
import { formatUpdatedAt } from '@/lib/format';

export default function ClientLists({ lists }) {
  if (!lists.length) return <EmptyState icon="list" title="Nenhuma lista disponível" text="O escritório ainda está preparando suas listas." />;
  return <div className="lists">
    {lists.map((list) => <article key={list.id} className="card lcard">
      <div className="top"><h3><Link href={`/my-lists/${list.id}`}>{list.name}</Link></h3></div>
      {list.description && <p>{list.description}</p>}
      <Progress total={list.totalProducts} done={list.boughtProducts} />
      <div className="nums"><span>{list.boughtProducts} de {list.totalProducts} comprados</span></div>
      <div className="foot">
        <span className="meta">Atualizada {formatUpdatedAt(list.updatedAt)}</span>
        <StatusBadge total={list.totalProducts} done={list.boughtProducts} completed={list.completed} />
        <Button href={`/my-lists/${list.id}`} variant="ghost" size="sm">Abrir lista</Button>
      </div>
    </article>)}
  </div>;
}
