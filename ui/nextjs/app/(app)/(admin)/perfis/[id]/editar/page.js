import { PageHeader } from '@/components/ui/Display';
import { ClientForm } from '@/components/clientes/Clientes';
import { getClient } from '@/components/clientes/queries.server';

export const metadata = { title: 'Editar perfil' };

export default async function Page({ params }) {
  const client = await getClient((await params).id);
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/perfis', label: 'Perfis' }, { href: `/perfis/${client.id}`, label: client.name }, { label: 'Editar' }]} title={<>Editar <em>perfil</em></>} />
      <ClientForm key={client.id} client={client} />
    </div>
  );
}
