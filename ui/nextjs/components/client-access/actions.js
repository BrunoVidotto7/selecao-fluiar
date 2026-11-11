'use server';
import { revalidatePath } from 'next/cache';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';
function requireId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

export async function inviteClient(clientId) {
  return actionResult(async () => {
    requireId(clientId);
    const invitation = await apiRequest(`/api/clients/${clientId}/invitations`, { method: 'POST' });
    revalidatePath(`/perfis/${clientId}`);
    return invitation;
  });
}

export async function revokeClientInvitation(clientId, invitationId) {
  return actionResult(async () => {
    requireId(clientId);
    requireId(invitationId);
    await apiRequest(`/api/clients/${clientId}/invitations/${invitationId}`, { method: 'DELETE' });
    revalidatePath(`/perfis/${clientId}`);
  });
}
