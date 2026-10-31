'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

/** @param {string} listId @returns {Promise<import('@/lib/api.server').ActionResult<{ shareToken: string }>>} */
export async function rotateShareToken(listId) {
  return actionResult(async () => {
    if (!isUuid(listId)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    const response = await apiRequest(`/api/lists/${listId}/share-token`, { method: 'POST' });
    revalidateWorkspaceData();
    return response;
  });
}
