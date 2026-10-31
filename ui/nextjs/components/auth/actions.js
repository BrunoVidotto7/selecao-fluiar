'use server';
import { redirect } from 'next/navigation';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
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
    await setSession(authResponse, { persistent: rememberMe });
    return authResponse.user;
  });
}

/**
 * @param {{ name: string, email: string, password: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('@/lib/api.server').MeResponse>>}
 */
export async function signup(input) {
  return actionResult(async () => {
    requireStringFields(input, ['name', 'email', 'password']);

    const { name, email, password } = input;
    const authResponse = await apiRequest('/api/auth/signup', {
      method: 'POST', auth: 'public', body: { name, email, password },
    });
    await setSession(authResponse);
    return authResponse.user;
  });
}

/** @returns {Promise<never>} */
export async function logout() {
  await clearSession();
  redirect('/login');
}
