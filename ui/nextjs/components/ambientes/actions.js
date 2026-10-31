'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

function roomBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.name !== 'string') {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return { name: input.name };
}

/** @param {string} listId @param {{ name: string }} input @returns {Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').RoomResponse>>} */
export async function createRoom(listId, input) {
  return actionResult(async () => {
    requireId(listId);
    const body = roomBody(input);
    const room = await apiRequest(`/api/lists/${listId}/rooms`, { method: 'POST', body });
    revalidateWorkspaceData();
    return room;
  });
}

/** @param {string} roomId @param {{ name: string }} input @returns {Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').RoomResponse>>} */
export async function renameRoom(roomId, input) {
  return actionResult(async () => {
    requireId(roomId);
    const body = roomBody(input);
    const room = await apiRequest(`/api/rooms/${roomId}`, { method: 'PUT', body });
    revalidateWorkspaceData();
    return room;
  });
}

/** @param {string} roomId @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>} */
export async function deleteRoom(roomId) {
  return actionResult(async () => {
    requireId(roomId);
    await apiRequest(`/api/rooms/${roomId}`, { method: 'DELETE' });
    revalidateWorkspaceData();
  });
}

/** @param {string} listId @param {string[]} roomIds @returns {Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').RoomResponse[]>>} */
export async function reorderRooms(listId, roomIds) {
  return actionResult(async () => {
    requireId(listId);
    if (!Array.isArray(roomIds) || !roomIds.length || !Array.from(roomIds).every(isUuid)
        || new Set(roomIds.map((id) => id.toLowerCase())).size !== roomIds.length) {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }
    const rooms = await apiRequest(`/api/lists/${listId}/room-order`, { method: 'PUT', body: { roomIds } });
    revalidateWorkspaceData();
    return rooms;
  });
}
