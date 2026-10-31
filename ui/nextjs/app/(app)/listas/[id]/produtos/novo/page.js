import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Display';
import ProductForm from '@/components/produtos/ProductForm';
import { LISTS, ROOM_NAMES, getList, getClient } from '@/lib/data';

export function generateStaticParams() { return LISTS.map((l) => ({ id: l.id })); }
export const metadata = { title: 'Novo produto' };

export default async function Page({ params, searchParams }) {
  const list = getList((await params).id);
  if (!list) notFound();
  const ambiente = (await searchParams)?.ambiente;
  const room = ROOM_NAMES.includes(ambiente) ? ambiente : '';
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas' }, { href: `/listas/${list.id}`, label: list.name }, { label: 'Novo produto' }]}
        title={<>Novo <em>produto</em></>} meta={`${list.name} · ${getClient(list.clientId).name}`} />
      <ProductForm key={room} listId={list.id} rooms={ROOM_NAMES} defaultRoom={room} />
    </div>
  );
}
