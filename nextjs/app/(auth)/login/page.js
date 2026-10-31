import { LoginForm } from '@/components/auth/AuthForms';
export const metadata = { title: 'Entrar' };
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  return <LoginForm showError={sp?.estado === 'erro'} />;
}
