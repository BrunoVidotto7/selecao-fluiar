import { PageHeader } from '@/components/ui/Display';
import { ListForm } from '@/components/listas/Listas';
import { CLIENTS, getClient } from '@/lib/data';

export const metadata = { title: 'Nova lista' };
export default async function Page({ searchParams }) {
  const cliente = getClient((await searchParams)?.cliente)?.id ?? '';
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas de compras' }, { label: 'Nova lista' }]} title={<>Nova <em>lista</em></>}
        meta="Depois de salvar, adicione os produtos por ambiente." />
      <ListForm clients={CLIENTS} defaultClientId={cliente} />
    </div>
  );
}
