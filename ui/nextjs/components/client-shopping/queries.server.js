import 'server-only';
import { cache } from 'react';
import { readApi } from '@/lib/api.server';
import { requireUuid } from '@/lib/route-input';

export async function getClientLists() {
  return readApi('/api/client/lists');
}

export const getClientList = cache(async (listId) => readApi(`/api/client/lists/${requireUuid(listId)}`));
