import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Display';
import { ListForm } from '@/components/listas/Listas';
import { CLIENTS, LISTS, getList } from '@/lib/data';

export function generateStaticParams() { return LISTS.map((l) => ({ id: l.id })); }
export const metadata = { title: 'Editar lista' };

export default async function Page({ params }) {
  const list = getList((await params).id);
  if (!list) notFound();
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas de compras' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Editar' }]} title={<>Editar <em>lista</em></>} />
      <ListForm list={list} clients={CLIENTS} />
    </div>
  );
}
