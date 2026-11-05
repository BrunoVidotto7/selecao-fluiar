'use server';
import { revalidatePath } from 'next/cache';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

export async function markClientChangesRead(listId, observedRevision) {
  return actionResult(async () => {
    if (!isUuid(listId) || !Number.isSafeInteger(observedRevision) || observedRevision < 0) {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }
    await apiRequest(`/api/lists/${listId}/client-changes/read`, { method: 'POST', body: { observedRevision } });
    revalidatePath('/dashboard');
  });
}
