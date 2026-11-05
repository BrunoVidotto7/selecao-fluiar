import { requireClient } from '@/lib/auth.server';
export default async function Layout({ children }) {
  await requireClient();
  return children;
}
