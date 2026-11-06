'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { requireAdmin } from '@/lib/auth.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';
import { validateProductImage, validateClientNotes } from '@/lib/validation';
import { downloadProductImage, fetchPageImages } from '@/lib/image-import.server';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';
const NOT_FOUND_DETAIL = 'Não encontramos o que você procurava.';
const MAX_LINK_LENGTH = 2048;

const isUnit = (unit) => unit === 'UNIT' || unit === 'SQUARE_METER';

function requireId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

function statusBody(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || (patch.bought != null && typeof patch.bought !== 'boolean')
      || (patch.quantity != null && !Number.isFinite(patch.quantity))) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return { bought: patch.bought, quantity: patch.quantity };
}

function storeSyncBody(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.sourceUrl !== 'string' || !value.sourceUrl.trim() || value.sourceUrl.length > MAX_LINK_LENGTH
      || (value.variantId != null && (typeof value.variantId !== 'string' || !value.variantId.trim() || value.variantId.length > MAX_LINK_LENGTH))) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return { sourceUrl: value.sourceUrl.trim(), ...(value.variantId == null ? {} : { variantId: value.variantId }) };
}

function productBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.name !== 'string' || !isUuid(input.roomId) || !isUuid(input.categoryId)
      || !Number.isFinite(input.quantity)
      || (input.unit != null && !isUnit(input.unit))
      || (input.unitPrice != null && (typeof input.unitPrice !== 'number' || !Number.isFinite(input.unitPrice)))
      || (input.notes != null && typeof input.notes !== 'string')
      || (input.bought != null && typeof input.bought !== 'boolean')
      || (input.links != null && (!Array.isArray(input.links) || !Array.from(input.links).every((link) =>
        link && typeof link === 'object' && !Array.isArray(link) && typeof link.url === 'string'
        && (link.note == null || typeof link.note === 'string'))))) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return {
    ...(Object.hasOwn(input, 'storeSync') ? { storeSync: storeSyncBody(input.storeSync) } : {}),
    roomId: input.roomId, categoryId: input.categoryId, name: input.name, quantity: input.quantity,
    ...(input.unit == null ? {} : { unit: input.unit }),
    unitPrice: input.unitPrice ?? null, notes: input.notes ?? null,
    ...(input.bought == null ? {} : { bought: input.bought }),
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
 * @param {{ roomId: string, categoryId: string, name: string, quantity: number, unitPrice?: number | null, notes?: string | null, bought?: boolean | null, links?: { url: string, note?: string | null }[] | null }} input
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

/** @param {string} pageUrl @returns {Promise<import('@/lib/api.server').ActionResult<{ images: string[] }>>} */
export async function findProductImages(pageUrl) {
  return actionResult(async () => {
    await requireAdmin();
    if (typeof pageUrl !== 'string' || !pageUrl.trim() || pageUrl.length > MAX_LINK_LENGTH) {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }
    return { images: await fetchPageImages(pageUrl.trim()) };
  });
}

/** @param {string} listId @param {string} productId @param {string} imageUrl
 * @returns {Promise<import('@/lib/api.server').ActionResult<{ imageUrl: string }>>} */
export async function uploadProductImageFromUrl(listId, productId, imageUrl) {
  return actionResult(async () => {
    await requireAdmin();
    requireId(listId);
    requireId(productId);
    if (typeof imageUrl !== 'string' || !imageUrl.trim() || imageUrl.length > MAX_LINK_LENGTH) {
      throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
    }
    await requireProductInList(listId, productId);
    const body = new FormData();
    body.append('file', await downloadProductImage(imageUrl.trim()));
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

export async function saveProductClientNotes(listId, productId, clientNotes) {
  return actionResult(async () => {
    requireId(listId);
    requireId(productId);
    const error = validateClientNotes(clientNotes);
    if (error) throw new ApiError(HTTP_BAD_REQUEST, error, { clientNotes: error });
    await requireProductInList(listId, productId);
    const product = await apiRequest(`/api/products/${productId}/client-notes`, {
      method: 'PUT', body: { clientNotes: clientNotes?.trim() || null },
    });
    revalidateWorkspaceData();
    return product;
  });
}

export async function previewStoreProduct(url, variantId) {
  return actionResult(async () => {
    await requireAdmin();
    const source = storeSyncBody({ sourceUrl: url, variantId });
    return apiRequest('/api/product-imports/preview', {
      method: 'POST', body: { url: source.sourceUrl, ...(source.variantId == null ? {} : { variantId: source.variantId }) },
    });
  });
}
