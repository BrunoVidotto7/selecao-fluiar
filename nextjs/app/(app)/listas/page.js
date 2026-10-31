import Button from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Display';
import { ListsTable } from '@/components/listas/Listas';
import { LISTS, getClient } from '@/lib/data';

export const metadata = { title: 'Listas de compras' };

export default async function Page({ searchParams }) {
  const empty = (await searchParams)?.estado === 'vazio';
  const lists = empty ? [] : LISTS.map((l) => ({ ...l, clientName: getClient(l.clientId).name }));
  return (
    <div className="wrap">
      <PageHeader eyebrow="Listas de compras" title={<>Todas as <em>listas</em></>} actions={<Button href="/listas/nova" icon="plus">Criar lista</Button>} />
      <ListsTable lists={lists} />
    </div>
  );
}
