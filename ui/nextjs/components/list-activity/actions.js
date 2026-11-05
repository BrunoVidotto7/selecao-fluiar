'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireListId(listId) {
  if (!isUuid(listId)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

export async function recordAdminListActivity(listId) {
  return actionResult(async () => {
    requireListId(listId);
    await apiRequest(`/api/lists/${listId}/activity`, { method: 'POST' });
  });
}

export async function recordClientListActivity(listId) {
  return actionResult(async () => {
    requireListId(listId);
    await apiRequest(`/api/client/lists/${listId}/activity`, { method: 'POST' });
  });
}
