'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { revalidatePath } from 'next/cache';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

/** @typedef {{ id: string, name: string, members: { id: string, name: string, email: string }[] }} OfficeResponse */
/** @typedef {{ id: string, email: string, expiresAt: string, createdAt: string }} InvitationResponse */

function requireStringField(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input[field] !== 'string') {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
}

/**
 * @param {{ name: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<OfficeResponse>>}
 */
export async function renameOffice(input) {
  return actionResult(async () => {
    requireStringField(input, 'name');
    const office = await apiRequest('/api/office', { method: 'PUT', body: { name: input.name } });
    revalidatePath('/(app)', 'layout');
    return office;
  });
}
