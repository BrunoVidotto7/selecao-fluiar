import AppShell from '@/components/layout/AppShell';
import { getCurrentUser } from '@/lib/api.server';

export default async function Layout({ children }) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
