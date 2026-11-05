'use server';
import { revalidatePath } from 'next/cache';
import { actionResult, ApiError, apiRequest, authenticatedUser, authenticatedSession } from '@/lib/api.server';
import { setSession } from '@/lib/session.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireStringFields(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || fields.some((field) => typeof input[field] !== 'string')) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
}

/**
 * @param {{ name: string, email: string, currentPassword?: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('@/lib/api.server').MeResponse>>}
 */
export async function updateProfile(input) {
  return actionResult(async () => {
    requireStringFields(input, ['name', 'email']);
    if (input.currentPassword !== undefined && typeof input.currentPassword !== 'string') {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }

    const { name, email, currentPassword } = input;
    const user = await apiRequest('/api/me', {
      method: 'PUT', body: { name, email, ...(currentPassword !== undefined ? { currentPassword } : {}) },
    });
    revalidatePath('/(app)', 'layout');
    revalidatePath('/listas/[id]', 'layout');
    return authenticatedUser(user);
  });
}

/**
 * @param {{ currentPassword: string, newPassword: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('@/lib/api.server').MeResponse>>}
 */
export async function changePassword(input) {
  return actionResult(async () => {
    requireStringFields(input, ['currentPassword', 'newPassword']);

    const { currentPassword, newPassword } = input;
    const authResponse = await apiRequest('/api/me/password', {
      method: 'PUT', body: { currentPassword, newPassword },
    });
    const session = authenticatedSession(authResponse);
    await setSession(session, { persistent: false });
    revalidatePath('/(app)', 'layout');
    return session.user;
  });
}
