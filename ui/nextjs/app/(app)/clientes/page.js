import Button from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Display';
import { ClientsTable } from '@/components/clientes/Clientes';
import { CLIENTS, listsOf } from '@/lib/data';

export const metadata = { title: 'Clientes' };

export default async function Page({ searchParams }) {
  const empty = (await searchParams)?.estado === 'vazio';
  const clients = empty ? [] : CLIENTS.map((c) => ({ ...c, listCount: listsOf(c.id).length }));
  return (
    <div className="wrap">
      <PageHeader eyebrow="Clientes" title={<>Seus <em>clientes</em></>} actions={<Button href="/clientes/novo" icon="plus">Adicionar cliente</Button>} />
      <ClientsTable key={empty ? 'vazio' : 'cheio'} clients={clients} />
    </div>
  );
}
