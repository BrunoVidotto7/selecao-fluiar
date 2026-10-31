import Button from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Display';
import { ClientsTable } from '@/components/clientes/Clientes';
import { readApi } from '@/lib/api.server';

export const metadata = { title: 'Clientes' };

export default async function Page() {
  const clients = await readApi('/api/clients');
  return (
    <div className="wrap">
      <PageHeader eyebrow="Clientes" title={<>Seus <em>clientes</em></>} actions={<Button href="/clientes/novo" icon="plus">Adicionar cliente</Button>} />
      <ClientsTable clients={clients} />
    </div>
  );
}
