import 'server-only';
import { cache } from 'react';
import { readApi } from '@/lib/api.server';
import { requireUuid } from '@/lib/route-input';

/** @typedef {{ totalProducts: number, boughtProducts: number, pendingProducts: number, estimatedTotal: number, remainingTotal: number }} ListStatsResponse */
/** @typedef {{ id: string, roomId: string, name: string, quantity: number, unit: 'UNIT' | 'SQUARE_METER', unitPrice: number | null, notes: string | null, clientNotes: { clientId: string, clientName: string, text: string, updatedAt: string }[], bought: boolean, imageUrl: string | null, category: { id: string, name: string, deleted: boolean }, storeSync?: { sourceUrl: string, store: string, productId: string, variantId: string | null, enabled: boolean, lastAttemptAt: string | null, lastSyncedAt: string | null, status: string } | null, links: { url: string, note: string | null }[] }} ProductResponse */
/** @typedef {{ id: string, name: string, position: number, products: ProductResponse[] }} RoomResponse */
/** @typedef {{ productId: string, purchase?: { revision: number, changedAt: string, value: boolean, clientId: string, clientName: string | null }, notes?: { clientId: string, clientName: string | null, revision: number, changedAt: string, value: string | null }[] }} ChangedProduct */
/** @typedef {{ observedRevision: number, products: ChangedProduct[] }} ClientChangesResponse */
/** @typedef {{ clientChanges: ClientChangesResponse, id: string, name: string, description: string | null, clientId: string, clientName: string, members: { clientId: string, clientName: string, role: 'READER' | 'EDITOR' }[], projectCode: string | null, contract: string | null, contractorName: string | null, contractorDocument: string | null, siteZipCode: string | null, siteAddress: string | null, shareToken: string, updatedAt: string, stats: ListStatsResponse, rooms: RoomResponse[] }} ListDetailResponse */
/** @typedef {{ id: string, name: string, description: string | null, clientId: string, clientName: string, totalProducts: number, boughtProducts: number, estimatedTotal: number, updatedAt: string, completed: boolean }} ListSummaryResponse */

/** @param {string} id @returns {Promise<ListDetailResponse>} */
export const getList = cache(async (id) => readApi(`/api/lists/${requireUuid(id)}`));
