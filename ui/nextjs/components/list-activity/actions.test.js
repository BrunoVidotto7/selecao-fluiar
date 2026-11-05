// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { recordAdminListActivity, recordClientListActivity } from './actions';
import { LIST } from '@/test-support/fixtures';
const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api.server', async (original) => ({ ...await original(), apiRequest }));
beforeEach(() => apiRequest.mockReset().mockResolvedValue(undefined));
test.each([
  [recordAdminListActivity, `/api/lists/${LIST.id}/activity`],
  [recordClientListActivity, `/api/client/lists/${LIST.id}/activity`],
])('activity writes the fixed authorized profile endpoint without a body', async (record, path) => {
  expect(await record(LIST.id)).toEqual({ ok: true, data: undefined });
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(path, { method: 'POST' });
});
test.each([[null], ['../other'], [LIST.id + '?admin=true'], [[]]])('activity rejects malformed identifiers before HTTP: %j', async (id) => {
  for (const record of [recordAdminListActivity, recordClientListActivity]) {
    expect(await record(id)).toMatchObject({ ok: false, status: 400 });
  }
  expect(apiRequest).not.toHaveBeenCalled();
});
