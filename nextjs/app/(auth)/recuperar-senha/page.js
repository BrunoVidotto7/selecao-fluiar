import { ForgotPasswordForm } from '@/components/auth/AuthForms';
export const metadata = { title: 'Recuperar senha' };
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  return <ForgotPasswordForm sent={sp?.estado === 'enviado'} />;
}
