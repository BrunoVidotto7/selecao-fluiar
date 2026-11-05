import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useClientChangeVisit } from './useClientChangeVisit';
import { markClientChangesRead } from './actions';
import { LIST, PRODUCT } from '@/test-support/fixtures';
vi.mock('./actions', () => ({ markClientChangesRead: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
const changes = { observedRevision: 1, products: [{ productId: PRODUCT.id, purchase: { revision: 1, changedAt: '2026-11-05T12:00:00Z', value: true } }] };
beforeEach(() => markClientChangesRead.mockReset().mockResolvedValue({ ok: true }));
test('captures once, confirms once in StrictMode, and retains highlights on refresh', async () => {
  let resolve;
  markClientChangesRead.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(({ data }) => useClientChangeVisit(LIST.id, data), {
    initialProps: { data: changes }, wrapper: StrictMode,
  });
  expect(result.current.readStatus).toBe('pending');
  expect(markClientChangesRead).toHaveBeenCalledExactlyOnceWith(LIST.id, 1);
  rerender({ data: { observedRevision: 2, products: [] } });
  await act(async () => resolve({ ok: true }));
  expect(result.current.readStatus).toBe('success');
  expect(result.current.changesByProduct.get(PRODUCT.id)).toEqual(changes.products[0]);
  expect(markClientChangesRead).toHaveBeenCalledTimes(1);
});
test('retries the original revision and blocks overlapping attempts', async () => {
  markClientChangesRead.mockResolvedValueOnce({ ok: false });
  const { result, rerender } = renderHook(({ data }) => useClientChangeVisit(LIST.id, data), { initialProps: { data: changes } });
  await act(async () => {});
  expect(result.current.readStatus).toBe('error');
  rerender({ data: { observedRevision: 2, products: [] } });
  let resolve;
  markClientChangesRead.mockReturnValue(new Promise((done) => { resolve = done; }));
  act(() => { result.current.retry(); result.current.retry(); });
  expect(markClientChangesRead).toHaveBeenCalledTimes(2);
  expect(markClientChangesRead).toHaveBeenLastCalledWith(LIST.id, 1);
  await act(async () => resolve({ ok: true }));
  expect(result.current.readStatus).toBe('success');
});
test('empty opening sends no confirmation and a remount captures a new visit', async () => {
  const empty = renderHook(() => useClientChangeVisit(LIST.id, { observedRevision: 4, products: [] }));
  await act(async () => {});
  expect(markClientChangesRead).not.toHaveBeenCalled();
  empty.unmount();
  const next = renderHook(() => useClientChangeVisit(LIST.id, changes));
  await act(async () => {});
  expect(markClientChangesRead).toHaveBeenCalledExactlyOnceWith(LIST.id, 1);
  expect(next.result.current.readStatus).toBe('success');
});
test('transport failure supports retry and settlement after unmount is ignored', async () => {
  markClientChangesRead.mockRejectedValueOnce(new Error('offline'));
  const visit = renderHook(() => useClientChangeVisit(LIST.id, changes));
  await act(async () => {});
  expect(visit.result.current.readStatus).toBe('error');
  let resolve;
  markClientChangesRead.mockReturnValue(new Promise((done) => { resolve = done; }));
  act(() => visit.result.current.retry());
  visit.unmount();
  await act(async () => resolve({ ok: true }));
});
