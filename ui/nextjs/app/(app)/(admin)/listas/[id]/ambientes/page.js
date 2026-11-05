import RoomManager from '@/components/ambientes/RoomManager';
import Button from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Display';
import { getList } from '@/components/listas/queries.server';
import { requireUuid } from '@/lib/route-input';

export const metadata = { title: 'Gerenciar ambientes' };

export default async function Page({ params }) {
  const id = requireUuid((await params).id);
  const list = await getList(id);
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas de compras' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Ambientes' }]}
        title={<>Gerenciar <em>ambientes</em></>} meta="Adicione, renomeie e organize os ambientes desta lista."
        actions={<Button href={`/listas/${list.id}`} variant="ghost">Voltar à lista</Button>} />
      <RoomManager key={list.id} listId={list.id} rooms={list.rooms} />
    </div>
  );
}
