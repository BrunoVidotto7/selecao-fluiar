import { PageHeader } from '@/components/ui/Display';
import { ClientForm } from '@/components/clientes/Clientes';

export const metadata = { title: 'Novo perfil' };
export default function Page() {
  return (
    <div className="wrap narrow">
      <PageHeader crumbs={[{ href: '/perfis', label: 'Perfis' }, { label: 'Novo perfil' }]} title={<>Novo <em>perfil</em></>}
        meta="Depois de salvar, você já pode criar a primeira lista de compras." />
      <ClientForm />
    </div>
  );
}
