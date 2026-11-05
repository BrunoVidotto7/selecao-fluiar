'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { validateClientNotes } from '@/lib/validation';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';
function productPath(listId, productId) {
  if (!isUuid(listId) || !isUuid(productId)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  return `/api/client/lists/${listId}/products/${productId}`;
}

export async function setClientPurchase(listId, productId, bought) {
  return actionResult(async () => {
    const path = productPath(listId, productId);
    if (typeof bought !== 'boolean') throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    const product = await apiRequest(path, { method: 'PATCH', body: { bought } });
    revalidateWorkspaceData();
    return product;
  });
}

export async function saveClientNotes(listId, productId, clientNotes) {
  return actionResult(async () => {
    const path = productPath(listId, productId);
    const error = validateClientNotes(clientNotes);
    if (error) throw new ApiError(HTTP_BAD_REQUEST, error, { clientNotes: error });
    const product = await apiRequest(path + '/client-notes', {
      method: 'PUT', body: { clientNotes: clientNotes?.trim() || null },
    });
    revalidateWorkspaceData();
    return product;
  });
}
