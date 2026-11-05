'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';

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

function requireCategoryId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

function refreshCategories() {
  revalidateWorkspaceData();
  revalidatePath('/escritorio');
}

/**
 * @param {{ name: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<{ id: string, name: string, productCount: number }>>}
 */
export async function createCategory(input) {
  return actionResult(async () => {
    requireStringField(input, 'name');
    const category = await apiRequest('/api/office/categories', { method: 'POST', body: { name: input.name } });
    refreshCategories();
    return category;
  });
}

/**
 * @param {string} id
 * @param {{ name: string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<{ id: string, name: string, productCount: number }>>}
 */
export async function renameCategory(id, input) {
  return actionResult(async () => {
    requireCategoryId(id);
    requireStringField(input, 'name');
    const category = await apiRequest(`/api/office/categories/${id}`, { method: 'PUT', body: { name: input.name } });
    refreshCategories();
    return category;
  });
}

/**
 * @param {string} id
 * @returns {Promise<import('@/lib/api.server').ActionResult<null>>}
 */
export async function deleteCategory(id) {
  return actionResult(async () => {
    requireCategoryId(id);
    await apiRequest(`/api/office/categories/${id}`, { method: 'DELETE' });
    refreshCategories();
    return null;
  });
}
