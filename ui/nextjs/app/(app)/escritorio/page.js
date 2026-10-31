import { readApi } from '@/lib/api.server';
import OfficeManager from '@/components/escritorio/OfficeManager';
import { PageHeader } from '@/components/ui/Display';

export const metadata = { title: 'Escritório' };

export default async function Page() {
  const [office, invitations] = await Promise.all([
    readApi('/api/office'),
    readApi('/api/office/invitations'),
  ]);
  const now = new Date().toISOString();
  return (
    <div className="wrap">
      <PageHeader eyebrow="Escritório" title={<>Seu <em>escritório</em></>} meta="Dados do escritório, membros e convites para sua equipe." />
      <OfficeManager office={office} invitations={invitations} now={now} />
    </div>
  );
}
