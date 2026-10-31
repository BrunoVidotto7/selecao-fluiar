import { LoginForm } from '@/components/auth/AuthForms';
export const metadata = { title: 'Entrar' };
export default async function Page({ searchParams }) {
  const showError = (await searchParams)?.estado === 'erro';
  return <LoginForm key={showError ? 'erro' : 'normal'} showError={showError} />;
}
