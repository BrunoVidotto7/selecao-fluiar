import { redirect } from 'next/navigation';
import { isLinkToken } from '@/lib/route-input';
export default async function Page({ searchParams }) {
  const token = (await searchParams)?.token;
  redirect(isLinkToken(token) ? '/invitation?token=' + token : '/invitation');
}
