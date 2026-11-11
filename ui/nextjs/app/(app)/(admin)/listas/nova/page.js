import { PageHeader } from '@/components/ui/Display';
import { ListForm } from '@/components/listas/Listas';
import { readApi } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';

export const metadata = { title: 'Nova lista' };
export default async function Page({ searchParams }) {
  const [clients, query] = await Promise.all([readApi('/api/clients'), searchParams]);
  const requestedClientId = query?.perfil;
  const cliente = isUuid(requestedClientId)
    ? clients.find((client) => client.id.toLowerCase() === requestedClientId.toLowerCase())?.id ?? ''
    : '';
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/listas', label: 'Listas de compras' }, { label: 'Nova lista' }]} title={<>Nova <em>lista</em></>}
        meta="Depois de salvar, adicione os produtos por ambiente." />
      <ListForm key={cliente} clients={clients} defaultClientId={cliente} />
    </div>
  );
}
