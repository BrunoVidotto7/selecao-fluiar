import { PageHeader } from '@/components/ui/Display';
import SettingsForm from '@/components/configuracoes/SettingsForm';
import { USER } from '@/lib/data';

export const metadata = { title: 'Configurações' };
export default function Page() {
  return (
    <div className="wrap narrow">
      <PageHeader eyebrow="Configurações" title={<>Sua <em>conta</em></>} meta="Dados que aparecem para os seus clientes e acesso ao sistema." />
      <SettingsForm user={USER} />
    </div>
  );
}
