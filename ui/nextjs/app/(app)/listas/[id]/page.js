import ShoppingList from '@/components/lista/ShoppingList';
import { getList } from '@/components/listas/queries.server';
import { readApi } from '@/lib/api.server';
import { requireUuid } from '@/lib/route-input';

export async function generateMetadata({ params }) {
  const list = await getList((await params).id);
  return { title: list.name };
}

export default async function Page({ params }) {
  const id = requireUuid((await params).id);
  const [list, office] = await Promise.all([getList(id), readApi('/api/office')]);
  const signature = { officeName: office.name, architectNames: office.members.map((member) => member.name) };
  return (
    <div className="wrap doc">
      <ShoppingList key={list.id} list={list} signature={signature} />
    </div>
  );
}
