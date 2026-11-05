import 'server-only';
import { readApi, ApiError } from '@/lib/api.server';
import { isUuid, requireUuid } from '@/lib/route-input';

const ACCESS_STATES = ['NOT_INVITED', 'PENDING', 'EXPIRED', 'ACTIVE'];
const HTTP_BAD_GATEWAY = 502;
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';

export async function getClientAccess(clientId) {
  const access = await readApi(`/api/clients/${requireUuid(clientId)}/access`);
  const pending = access?.status === 'PENDING' || access?.status === 'EXPIRED';
  if (!ACCESS_STATES.includes(access?.status) || typeof access.email !== 'string' || !access.email.trim()
      || (pending && (!isUuid(access.invitationId) || !Number.isFinite(Date.parse(access.expiresAt))))) {
    throw new ApiError(HTTP_BAD_GATEWAY, INVALID_RESPONSE_DETAIL);
  }
  return access;
}
