import { notFound } from 'next/navigation';
import ShoppingList from '@/components/lista/ShoppingList';
import { LISTS, SAMPLE_ROOMS, getList, getClient } from '@/lib/data';

export function generateStaticParams() { return LISTS.map((l) => ({ id: l.id })); }
export async function generateMetadata({ params }) { return { title: getList((await params).id)?.name }; }

export default async function Page({ params, searchParams }) {
  const list = getList((await params).id);
  if (!list) notFound();
  const empty = (await searchParams)?.estado === 'vazio';
  // Protótipo: todas as listas usam os mesmos produtos de exemplo
  return (
    <div className="wrap doc">
      <ShoppingList key={empty ? 'vazio' : 'cheio'} list={list} client={getClient(list.clientId)} rooms={SAMPLE_ROOMS} empty={empty} />
    </div>
  );
}
