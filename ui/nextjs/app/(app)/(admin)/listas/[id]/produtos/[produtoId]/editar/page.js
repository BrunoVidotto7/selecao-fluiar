import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Display';
import ProductForm from '@/components/produtos/ProductForm';
import { getList } from '@/components/listas/queries.server';
import { requireUuid } from '@/lib/route-input';

export const metadata = { title: 'Editar produto' };

export default async function Page({ params }) {
  const { id, produtoId } = await params;
  requireUuid(produtoId);
  const list = await getList(id);
  const product = list.rooms.flatMap((room) => room.products).find((item) => item.id.toLowerCase() === produtoId.toLowerCase());
  if (!product) notFound();
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Editar produto' }]}
        title={<>Editar <em>produto</em></>} meta={`${list.name} · ${list.clientName}`} />
      <ProductForm key={`${list.id}:${product.id}`} listId={list.id} product={product} rooms={list.rooms} />
    </div>
  );
}
