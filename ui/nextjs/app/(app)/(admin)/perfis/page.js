import Button from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Display';
import { ClientsTable } from '@/components/clientes/Clientes';
import { readApi } from '@/lib/api.server';

export const metadata = { title: 'Perfis' };

export default async function Page() {
  const clients = await readApi('/api/clients');
  return (
    <div className="wrap">
      <PageHeader eyebrow="Perfis" title={<>Seus <em>perfis</em></>} actions={<Button href="/perfis/novo" icon="plus">Adicionar perfil</Button>} />
      <ClientsTable clients={clients} />
    </div>
  );
}
