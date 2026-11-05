// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { getClientChangePage } from './queries.server';
const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api.server', async (original) => ({ ...await original(), apiRequest }));
const page = { pendingListCount: 0, page: 0, pageSize: 20, items: [] };
beforeEach(() => apiRequest.mockReset().mockResolvedValue(page));
test('returns the API page and uses only the validated page number', async () => {
  expect(await getClientChangePage(0)).toEqual(page);
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith('/api/client-changes?page=0');
});
test.each([[-1], ['0'], [1.2], [2147483648], [NaN]])('rejects invalid page %j before HTTP', async (value) => {
  await expect(getClientChangePage(value)).rejects.toMatchObject({ status: 400 });
  expect(apiRequest).not.toHaveBeenCalled();
});
test.each([[null], [{}], [{ ...page, items: null }], [{ ...page, pendingListCount: -1 }],
  [{ ...page, items: [{ listId: 'bad' }] }]])('invalid response is an error rather than empty state', async (value) => {
  apiRequest.mockResolvedValue(value);
  await expect(getClientChangePage()).rejects.toMatchObject({ status: 502 });
});
