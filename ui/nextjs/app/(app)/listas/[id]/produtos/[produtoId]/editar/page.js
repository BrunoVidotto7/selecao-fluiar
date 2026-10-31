import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Display';
import ProductForm from '@/components/produtos/ProductForm';
import { LISTS, ROOM_NAMES, SAMPLE_ROOMS, getList, getClient, getProduct } from '@/lib/data';

export function generateStaticParams() {
  return LISTS.flatMap((l) => SAMPLE_ROOMS.flatMap((r) => r.items.map((p) => ({ id: l.id, produtoId: p.id }))));
}
export const metadata = { title: 'Editar produto' };

export default async function Page({ params }) {
  const { id, produtoId } = await params;
  const list = getList(id);
  const product = getProduct(produtoId);
  if (!list || !product) notFound();
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Editar produto' }]}
        title={<>Editar <em>produto</em></>} meta={`${list.name} · ${getClient(list.clientId).name}`} />
      <ProductForm listId={list.id} product={product} rooms={ROOM_NAMES} />
    </div>
  );
}
