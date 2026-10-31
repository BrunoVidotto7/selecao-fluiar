'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';
import { validateProductImage } from '@/lib/validation';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';
const NOT_FOUND_DETAIL = 'Não encontramos o que você procurava.';

function requireId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

function statusBody(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || (patch.bought != null && typeof patch.bought !== 'boolean')
      || (patch.quantity != null && !Number.isInteger(patch.quantity))) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return { bought: patch.bought, quantity: patch.quantity };
}

function productBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.name !== 'string' || !isUuid(input.roomId)
      || !Number.isInteger(input.quantity)
      || (input.unitPrice != null && (typeof input.unitPrice !== 'number' || !Number.isFinite(input.unitPrice)))
      || (input.notes != null && typeof input.notes !== 'string')
      || (input.bought != null && typeof input.bought !== 'boolean')
      || (input.links != null && (!Array.isArray(input.links) || !Array.from(input.links).every((link) =>
        link && typeof link === 'object' && !Array.isArray(link) && typeof link.url === 'string'
        && (link.note == null || typeof link.note === 'string'))))) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return {
    roomId: input.roomId, name: input.name, quantity: input.quantity,
    unitPrice: input.unitPrice ?? null, notes: input.notes ?? null, bought: input.bought ?? false,
    links: (input.links ?? []).map((link) => ({ url: link.url, note: link.note ?? null })),
  };
}

/** @returns {Promise<import('../listas/queries.server').ListDetailResponse>} */
async function requireProductInList(listId, productId) {
  const list = await apiRequest(`/api/lists/${listId}`);
  const belongs = list.rooms.some((room) => room.products.some((product) => product.id.toLowerCase() === productId.toLowerCase()));
  if (!belongs) throw new ApiError(HTTP_NOT_FOUND, NOT_FOUND_DETAIL);
  return list;
}

/**
 * @param {string} listId
 * @param {null | string} productId
 * @param {{ roomId: string, name: string, quantity: number, unitPrice?: number | null, notes?: string | null, bought?: boolean | null, links?: { url: string, note?: string | null }[] | null }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').ProductResponse>>}
 */
export async function saveProduct(listId, productId, input) {
  return actionResult(async () => {
    requireId(listId);
    if (productId !== null) requireId(productId);
    const body = productBody(input);
    if (productId !== null) await requireProductInList(listId, productId);

    const product = await apiRequest(productId === null ? `/api/lists/${listId}/products` : `/api/products/${productId}`, {
      method: productId === null ? 'POST' : 'PUT', body,
    });
    revalidateWorkspaceData();
    return product;
  });
}

/** @param {string} listId @param {string} productId @param {{ bought?: boolean | null, quantity?: number | null }} patch
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('../listas/queries.server').ProductResponse>>} */
export async function patchProduct(listId, productId, patch) {
  return actionResult(async () => {
    requireId(listId);
    requireId(productId);
    const body = statusBody(patch);
    await requireProductInList(listId, productId);
    const product = await apiRequest(`/api/products/${productId}`, { method: 'PATCH', body });
    revalidateWorkspaceData();
    return product;
  });
}

/** @param {string} listId @param {string} productId @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>} */
export async function deleteProduct(listId, productId) {
  return actionResult(async () => {
    requireId(listId);
    requireId(productId);
    await requireProductInList(listId, productId);
    await apiRequest(`/api/products/${productId}`, { method: 'DELETE' });
    revalidateWorkspaceData();
  });
}

/** @param {string} listId @param {string} productId @param {FormData} formData @returns {Promise<import('@/lib/api.server').ActionResult<{ imageUrl: string }>>} */
export async function uploadProductImage(listId, productId, formData) {
  return actionResult(async () => {
    requireId(listId);
    requireId(productId);
    if (!(formData instanceof FormData) || formData.getAll('file').length > 1) {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }
    const file = formData.get('file');
    const error = validateProductImage(file);
    if (error) throw new ApiError(HTTP_BAD_REQUEST, error);

    await requireProductInList(listId, productId);
    const body = new FormData();
    body.append('file', file);
    const image = await apiRequest(`/api/products/${productId}/image`, { method: 'PUT', body });
    revalidateWorkspaceData();
    return image;
  });
}

/** @param {string} listId @param {string} productId @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>} */
export async function deleteProductImage(listId, productId) {
  return actionResult(async () => {
    requireId(listId);
    requireId(productId);
    await requireProductInList(listId, productId);
    await apiRequest(`/api/products/${productId}/image`, { method: 'DELETE' });
    revalidateWorkspaceData();
  });
}
