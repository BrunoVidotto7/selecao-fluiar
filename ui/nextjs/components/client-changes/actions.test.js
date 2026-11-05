// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { markClientChangesRead } from './actions';
import { ApiError } from '@/lib/api.server';
import { LIST } from '@/test-support/fixtures';
const { apiRequest, revalidatePath } = vi.hoisted(() => ({ apiRequest: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/api.server', async (original) => ({ ...await original(), apiRequest }));
vi.mock('next/cache', () => ({ revalidatePath }));
beforeEach(() => { apiRequest.mockReset().mockResolvedValue(undefined); revalidatePath.mockReset(); });
test('confirms only the captured revision and invalidates dashboard after success', async () => {
  expect(await markClientChangesRead(LIST.id, 3)).toEqual({ ok: true, data: undefined });
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(`/api/lists/${LIST.id}/client-changes/read`, {
    method: 'POST', body: { observedRevision: 3 },
  });
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/dashboard');
});
test.each([[null, 1], ['../bad', 1], [LIST.id, -1], [LIST.id, 1.2], [LIST.id, '1'], [LIST.id, null],
  [LIST.id, Number.MAX_SAFE_INTEGER + 1]])('rejects invalid id or revision %j %j', async (id, revision) => {
  expect(await markClientChangesRead(id, revision)).toMatchObject({ ok: false, status: 400 });
  expect(apiRequest).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});
test('failed confirmation returns the safe error without invalidating', async () => {
  apiRequest.mockRejectedValue(new ApiError(503, 'Tente novamente.'));
  expect(await markClientChangesRead(LIST.id, 1)).toMatchObject({ ok: false, status: 503, detail: 'Tente novamente.' });
  expect(revalidatePath).not.toHaveBeenCalled();
});
