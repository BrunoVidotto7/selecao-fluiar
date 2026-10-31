import { PageHeader } from '@/components/ui/Display';
import { ClientForm } from '@/components/clientes/Clientes';
import { getClient } from '@/components/clientes/queries.server';

export const metadata = { title: 'Editar cliente' };

export default async function Page({ params }) {
  const client = await getClient((await params).id);
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/clientes', label: 'Clientes' }, { href: `/clientes/${client.id}`, label: client.name }, { label: 'Editar' }]} title={<>Editar <em>cliente</em></>} />
      <ClientForm key={client.id} client={client} />
    </div>
  );
}
