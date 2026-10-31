'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireClientId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

function clientBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.name !== 'string' || typeof input.email !== 'string' || typeof input.phone !== 'string') {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return { name: input.name, email: input.email, phone: input.phone };
}

/**
 * @param {null | string} id
 * @param {{ name: string, email: string, phone: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('./queries.server').ClientResponse>>}
 */
export async function saveClient(id, input) {
  return actionResult(async () => {
    if (id !== null) requireClientId(id);
    const body = clientBody(input);
    const client = await apiRequest(id === null ? '/api/clients' : `/api/clients/${id}`, {
      method: id === null ? 'POST' : 'PUT', body,
    });
    revalidateWorkspaceData();
    return client;
  });
}

/** @param {string} id @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>} */
export async function deleteClient(id) {
  return actionResult(async () => {
    requireClientId(id);
    await apiRequest(`/api/clients/${id}`, { method: 'DELETE' });
    revalidateWorkspaceData();
  });
}
