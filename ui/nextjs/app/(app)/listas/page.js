import Button from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Display';
import { ListsTable } from '@/components/listas/Listas';
import { readApi } from '@/lib/api.server';

export const metadata = { title: 'Listas de compras' };

export default async function Page() {
  const lists = await readApi('/api/lists');
  return (
    <div className="wrap">
      <PageHeader eyebrow="Listas de compras" title={<>Todas as <em>listas</em></>} actions={<Button href="/listas/nova" icon="plus">Criar lista</Button>} />
      <ListsTable lists={lists} />
    </div>
  );
}
