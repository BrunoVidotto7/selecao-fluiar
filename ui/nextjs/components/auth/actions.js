'use server';
import { redirect } from 'next/navigation';
import { actionResult, ApiError, apiRequest, authenticatedSession } from '@/lib/api.server';
import { isLinkToken } from '@/lib/route-input';
import { clearSession, setSession } from '@/lib/session.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireStringFields(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || fields.some((field) => typeof input[field] !== 'string')) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
}

/**
 * @param {{ email: string, password: string, rememberMe: boolean }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('@/lib/api.server').MeResponse>>}
 */
export async function login(input) {
  return actionResult(async () => {
    requireStringFields(input, ['email', 'password']);
    if (typeof input.rememberMe !== 'boolean') throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);

    const { email, password, rememberMe } = input;
    const authResponse = await apiRequest('/api/auth/login', {
      method: 'POST', auth: 'public', body: { email, password, rememberMe },
    });
    const session = authenticatedSession(authResponse);
    await setSession(session, { persistent: rememberMe });
    return session.user;
  });
}

/** @returns {Promise<never>} */
export async function logout() {
  await clearSession();
  redirect('/login');
}

/**
 * @param {{ email: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>}
 */
export async function requestPasswordReset(input) {
  return actionResult(async () => {
    requireStringFields(input, ['email']);

    const { email } = input;
    await apiRequest('/api/auth/password-reset-requests', {
      method: 'POST', auth: 'public', body: { email },
    });
  });
}

/**
 * @param {{ token: string, newPassword: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>}
 */
export async function confirmPasswordReset(input) {
  return actionResult(async () => {
    requireStringFields(input, ['token', 'newPassword']);
    if (!isLinkToken(input.token)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);

    const { token, newPassword } = input;
    await apiRequest('/api/auth/password-resets', {
      method: 'POST', auth: 'public', body: { token, newPassword },
    });
  });
}
