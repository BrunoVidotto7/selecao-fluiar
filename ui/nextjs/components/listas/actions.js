'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireListId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

function listBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.name !== 'string'
      || (input.description != null && typeof input.description !== 'string')
      || !isUuid(input.clientId)) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return { name: input.name, description: input.description ?? null, clientId: input.clientId };
}

/**
 * @param {null | string} id
 * @param {{ name: string, description: null | string, clientId: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('./queries.server').ListDetailResponse>>}
 */
export async function saveList(id, input) {
  return actionResult(async () => {
    if (id !== null) requireListId(id);
    const body = listBody(input);
    const list = await apiRequest(id === null ? '/api/lists' : `/api/lists/${id}`, {
      method: id === null ? 'POST' : 'PUT', body,
    });
    revalidateWorkspaceData();
    return list;
  });
}

/** @param {string} id @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>} */
export async function deleteList(id) {
  return actionResult(async () => {
    requireListId(id);
    await apiRequest(`/api/lists/${id}`, { method: 'DELETE' });
    revalidateWorkspaceData();
  });
}
