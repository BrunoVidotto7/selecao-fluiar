import 'server-only';
import { ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';

const PAGE_SIZE = 20;
const MAX_PAGE = 2147483647;
const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const COUNT_FIELDS = ['changedProductCount', 'purchaseMarkedCount', 'purchaseUnmarkedCount', 'notesChangedCount', 'notesRemovedCount'];
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

/** @typedef {{ listId: string, listName: string, clientId: string, clientName: string, changedProductCount: number, purchaseMarkedCount: number, purchaseUnmarkedCount: number, notesChangedCount: number, notesRemovedCount: number, lastChangedAt: string }} ClientChangeSummaryResponse */
/** @typedef {{ pendingListCount: number, page: number, pageSize: number, items: ClientChangeSummaryResponse[] }} ClientChangePageResponse */

/** @returns {Promise<ClientChangePageResponse>} */
export async function getClientChangePage(page = 0) {
  if (!nonnegativeInteger(page) || page > MAX_PAGE) throw new ApiError(HTTP_BAD_REQUEST, 'Revise os dados enviados.');
  const data = await apiRequest(`/api/client-changes?page=${page}`);
  if (!data || !nonnegativeInteger(data.pendingListCount) || data.page !== page || data.pageSize !== PAGE_SIZE
      || !Array.isArray(data.items) || data.items.length > PAGE_SIZE || !data.items.every((item) => item
        && isUuid(item.listId) && isUuid(item.clientId) && typeof item.listName === 'string' && typeof item.clientName === 'string'
        && COUNT_FIELDS.every((key) => nonnegativeInteger(item[key]))
        && typeof item.lastChangedAt === 'string' && Number.isFinite(Date.parse(item.lastChangedAt)))) {
    throw new ApiError(HTTP_BAD_GATEWAY, 'A API retornou uma resposta inválida.');
  }
  return data;
}
