import ClientShoppingList from '@/components/client-shopping/ClientShoppingList';
import { getClientList } from '@/components/client-shopping/queries.server';
export async function generateMetadata({ params }) {
  const list = await getClientList((await params).id);
  return { title: list.name };
}
export default async function Page({ params }) {
  const list = await getClientList((await params).id);
  return <div className="wrap doc"><ClientShoppingList list={list} /></div>;
}
