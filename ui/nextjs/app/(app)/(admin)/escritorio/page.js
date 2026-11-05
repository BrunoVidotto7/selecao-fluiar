import { readApi } from '@/lib/api.server';
import OfficeManager from '@/components/escritorio/OfficeManager';
import CategoryManager from '@/components/escritorio/CategoryManager';
import { PageHeader } from '@/components/ui/Display';

export const metadata = { title: 'Escritório' };

export default async function Page() {
  const [office, categories] = await Promise.all([readApi('/api/office'), readApi('/api/office/categories')]);
  return (
    <div className="wrap">
      <PageHeader eyebrow="Escritório" title={<>Seu <em>escritório</em></>} meta="Dados do escritório e administradores da sua equipe." />
      <OfficeManager office={office} />
      <CategoryManager categories={categories} />
    </div>
  );
}
