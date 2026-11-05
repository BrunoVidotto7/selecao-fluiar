import 'server-only';
import { cache } from 'react';
import { readApi } from '@/lib/api.server';
import { requireUuid } from '@/lib/route-input';

/** @typedef {{ totalProducts: number, boughtProducts: number, pendingProducts: number, estimatedTotal: number, remainingTotal: number }} ListStatsResponse */
/** @typedef {{ id: string, roomId: string, name: string, quantity: number, unitPrice: number | null, notes: string | null, clientNotes: string | null, bought: boolean, imageUrl: string | null, storeSync?: { sourceUrl: string, store: string, productId: string, variantId: string | null, enabled: boolean, lastAttemptAt: string | null, lastSyncedAt: string | null, status: string } | null, links: { url: string, note: string | null }[] }} ProductResponse */
/** @typedef {{ id: string, name: string, position: number, products: ProductResponse[] }} RoomResponse */
/** @typedef {{ id: string, name: string, description: string | null, clientId: string, clientName: string, shareToken: string, updatedAt: string, stats: ListStatsResponse, rooms: RoomResponse[] }} ListDetailResponse */
/** @typedef {{ id: string, name: string, description: string | null, clientId: string, clientName: string, totalProducts: number, boughtProducts: number, estimatedTotal: number, updatedAt: string, completed: boolean }} ListSummaryResponse */

/** @param {string} id @returns {Promise<ListDetailResponse>} */
export const getList = cache(async (id) => readApi(`/api/lists/${requireUuid(id)}`));
