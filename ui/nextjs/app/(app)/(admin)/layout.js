import { requireAdmin } from '@/lib/auth.server';
export default async function Layout({ children }) {
  await requireAdmin();
  return children;
}
