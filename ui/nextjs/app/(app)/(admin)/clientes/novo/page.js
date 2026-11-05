import { PageHeader } from '@/components/ui/Display';
import { ClientForm } from '@/components/clientes/Clientes';

export const metadata = { title: 'Novo cliente' };
export default function Page() {
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/clientes', label: 'Clientes' }, { label: 'Novo cliente' }]} title={<>Novo <em>cliente</em></>}
        meta="Depois de salvar, você já pode criar a primeira lista de compras." />
      <ClientForm />
    </div>
  );
}
