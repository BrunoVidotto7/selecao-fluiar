'use server';
import { actionResult, ApiError, apiRequest, authenticatedSession } from '@/lib/api.server';
import { isLinkToken } from '@/lib/route-input';
import { setSession } from '@/lib/session.server';

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';

export async function acceptInvitation(token, input) {
  return actionResult(async () => {
    if (!isLinkToken(token) || !input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).length !== 1 || typeof input.password !== 'string') {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }
    const response = await apiRequest(`/api/auth/invitations/${token}/acceptance`, {
      method: 'POST', auth: 'public', body: { password: input.password },
    });
    const session = authenticatedSession(response);
    if (session.user.role !== 'CLIENT') throw new ApiError(HTTP_BAD_GATEWAY, INVALID_RESPONSE_DETAIL);
    await setSession(session, { persistent: false });
    return session.user;
  });
}
