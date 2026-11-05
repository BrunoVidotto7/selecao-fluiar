import ClientLists from '@/components/client-shopping/ClientLists';
import { getClientLists } from '@/components/client-shopping/queries.server';
import { PageHeader } from '@/components/ui/Display';
export const metadata = { title: 'Minhas listas' };
export default async function Page() {
  const lists = await getClientLists();
  return <div className="wrap"><PageHeader title={<>Minhas <em>listas</em></>} meta="Acompanhe suas compras e deixe observações para o escritório." /><ClientLists lists={lists} /></div>;
}
