import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/Display';
import { ClientForm } from '@/components/clientes/Clientes';
import { CLIENTS, getClient, listsOf } from '@/lib/data';

export function generateStaticParams() { return CLIENTS.map((c) => ({ id: c.id })); }
export const metadata = { title: 'Editar cliente' };

export default async function Page({ params }) {
  const client = getClient((await params).id);
  if (!client) notFound();
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/clientes', label: 'Clientes' }, { href: `/clientes/${client.id}`, label: client.name }, { label: 'Editar' }]} title={<>Editar <em>cliente</em></>} />
      <ClientForm client={client} listCount={listsOf(client.id).length} />
    </div>
  );
}
