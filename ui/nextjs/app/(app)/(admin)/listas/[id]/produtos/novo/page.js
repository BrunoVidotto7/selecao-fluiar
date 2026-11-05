import { EmptyState, PageHeader } from '@/components/ui/Display';
import Button from '@/components/ui/Button';
import ProductForm from '@/components/produtos/ProductForm';
import { getList } from '@/components/listas/queries.server';
import { readApi } from '@/lib/api.server';

export const metadata = { title: 'Novo produto' };

export default async function Page({ params, searchParams }) {
  const [list, categories] = await Promise.all([getList((await params).id), readApi('/api/office/categories')]);
  const ambiente = (await searchParams)?.ambiente;
  const roomId = typeof ambiente === 'string'
    ? list.rooms.find((room) => room.id.toLowerCase() === ambiente.toLowerCase())?.id || '' : '';
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Novo produto' }]}
        title={<>Novo <em>produto</em></>} meta={`${list.name} · ${list.clientName}`} />
      {list.rooms.length
        ? <ProductForm key={`${list.id}:${roomId}`} listId={list.id} rooms={list.rooms} categories={categories} defaultRoomId={roomId} />
        : <EmptyState icon="layers" title="Adicione um ambiente primeiro" text="Organize os ambientes da lista para adicionar produtos.">
            <Button href={`/listas/${list.id}/ambientes`}>Gerenciar ambientes</Button>
          </EmptyState>}
    </div>
  );
}
