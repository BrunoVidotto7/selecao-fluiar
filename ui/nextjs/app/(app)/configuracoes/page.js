import { PageHeader } from '@/components/ui/Display';
import SettingsForm from '@/components/configuracoes/SettingsForm';
import { getCurrentUser } from '@/lib/api.server';

export const metadata = { title: 'Configurações' };
export default async function Page() {
  const user = await getCurrentUser();
  return (
    <div className="wrap narrow">
      <PageHeader eyebrow="Configurações" title={<>Sua <em>conta</em></>} meta="Dados que aparecem para os seus clientes e acesso ao sistema." />
      <SettingsForm user={user} />
    </div>
  );
}
