import 'server-only';
import { cache } from 'react';
import { readApi } from '@/lib/api.server';
import { requireUuid } from '@/lib/route-input';

/** @typedef {{ id: string, name: string, email: string, phone: string, birthDate: string | null, cpf: string | null, createdAt: string, updatedAt: string }} ClientResponse */
/** @typedef {{ id: string, name: string, email: string, phone: string, listCount: number, createdAt: string, updatedAt: string }} ClientSummaryResponse */
/** @typedef {ClientResponse & { lists: import('../listas/queries.server').ListSummaryResponse[], memberLists?: { id: string, name: string, role: 'EDITOR' | 'READER' }[] }} ClientDetailResponse */

/** @param {string} id @returns {Promise<ClientDetailResponse>} */
export const getClient = cache(async (id) => readApi(`/api/clients/${requireUuid(id)}`));
