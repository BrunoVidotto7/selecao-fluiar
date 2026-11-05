import { notFound, redirect } from 'next/navigation';
import { readApi, ApiError } from '@/lib/api.server';
import { isLinkToken, isUuid } from '@/lib/route-input';

const HTTP_BAD_GATEWAY = 502;
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';
export const metadata = { title: 'Lista compartilhada' };

export default async function Page({ params }) {
  const { shareToken } = await params;
  if (!isLinkToken(shareToken)) notFound();
  const access = await readApi(`/api/public/lists/${shareToken}`, { returnTo: `/l/${shareToken}` });
  if (!isUuid(access?.listId) || !['ADMIN', 'CLIENT'].includes(access.role)) {
    throw new ApiError(HTTP_BAD_GATEWAY, INVALID_RESPONSE_DETAIL);
  }
  redirect(access.role === 'ADMIN' ? `/listas/${access.listId}` : `/my-lists/${access.listId}`);
}
