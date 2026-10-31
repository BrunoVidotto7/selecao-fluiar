import { PageHeader } from '@/components/ui/Display';
import { ListForm } from '@/components/listas/Listas';
import { getList } from '@/components/listas/queries.server';
import { readApi } from '@/lib/api.server';
import { requireUuid } from '@/lib/route-input';

export const metadata = { title: 'Editar lista' };

export default async function Page({ params }) {
  const id = requireUuid((await params).id);
  const [list, clients] = await Promise.all([getList(id), readApi('/api/clients')]);
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas de compras' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Editar' }]} title={<>Editar <em>lista</em></>} />
      <ListForm key={list.id} list={list} clients={clients} />
    </div>
  );
}
