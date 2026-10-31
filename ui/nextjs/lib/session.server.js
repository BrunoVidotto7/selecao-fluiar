import 'server-only';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'fluiar_session';

/** @returns {Promise<string | null>} */
export async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || null;
}

/**
 * Call only from a Server Action, never during render.
 * @param {{ accessToken: string, expiresAt: string }} authResponse
 * @param {{ persistent?: boolean }} options
 * @returns {Promise<void>}
 */
export async function setSession(authResponse, { persistent = false } = {}) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, authResponse.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    ...(persistent ? { expires: new Date(authResponse.expiresAt) } : {}),
  });
}

/** Call only from a Server Action, never during render. */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
