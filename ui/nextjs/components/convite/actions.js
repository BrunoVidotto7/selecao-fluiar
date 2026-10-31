'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isLinkToken } from '@/lib/route-input';
import { setSession } from '@/lib/session.server';

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';
const USER_FIELDS = ['id', 'name', 'email', 'officeId', 'officeName'];

function requireAcceptanceInput(token, input) {
  if (!isLinkToken(token) || !input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.name !== 'string' || typeof input.password !== 'string') {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
}

function sanitizedUser(authResponse) {
  if (typeof authResponse?.accessToken !== 'string' || !authResponse.accessToken
      || USER_FIELDS.some((field) => typeof authResponse.user?.[field] !== 'string' || !authResponse.user[field].trim())) {
    throw new ApiError(HTTP_BAD_GATEWAY, INVALID_RESPONSE_DETAIL);
  }
  return Object.fromEntries(USER_FIELDS.map((field) => [field, authResponse.user[field]]));
}

/**
 * @param {string} token
 * @param {{ name: string, password: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('@/lib/api.server').MeResponse>>}
 */
export async function acceptInvitation(token, input) {
  return actionResult(async () => {
    requireAcceptanceInput(token, input);
    const authResponse = await apiRequest(`/api/auth/invitations/${token}/acceptance`, {
      method: 'POST', auth: 'public', body: { name: input.name, password: input.password },
    });
    const user = sanitizedUser(authResponse);
    await setSession(authResponse, { persistent: false });
    return user;
  });
}
