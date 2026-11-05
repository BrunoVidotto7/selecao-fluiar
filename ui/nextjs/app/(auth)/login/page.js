import { LoginForm } from '@/components/auth/AuthForms';
import { safeReturnPath } from '@/lib/auth-routing';
export const metadata = { title: 'Entrar' };
export default async function Page({ searchParams } = {}) {
  const query = await searchParams;
  return <LoginForm returnTo={safeReturnPath(query?.next)} />;
}
