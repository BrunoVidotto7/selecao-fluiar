import { ForgotPasswordForm } from '@/components/auth/AuthForms';
export const metadata = { title: 'Recuperar senha' };
export default async function Page({ searchParams }) {
  const sent = (await searchParams)?.estado === 'enviado';
  return <ForgotPasswordForm key={sent ? 'enviado' : 'normal'} sent={sent} />;
}
