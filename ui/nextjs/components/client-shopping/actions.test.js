// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { setClientPurchase, saveClientNotes } from './actions';
import { getClientList, getClientLists } from './queries.server';
import { CLIENT_LIST, CLIENT_LIST_SUMMARY, CLIENT_PRODUCT } from '@/test-support/fixtures';
const { fetchMock, revalidatePath, notFound } = vi.hoisted(() => ({
  fetchMock: vi.fn(), revalidatePath: vi.fn(), notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'client-jwt' }) }) }));
vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('purchase writes use only the owning-client endpoint and refresh saved data', async () => {
  const saved = { ...CLIENT_PRODUCT, bought: true };
  fetchMock.mockResolvedValue(new Response(JSON.stringify(saved)));
  expect(await setClientPurchase(CLIENT_LIST.id, CLIENT_PRODUCT.id, true)).toEqual({ ok: true, data: saved });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:8080/api/client/lists/${CLIENT_LIST.id}/products/${CLIENT_PRODUCT.id}`);
  expect(fetchMock.mock.calls[0][1].body).toBe('{"bought":true}');
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer client-jwt');
  expect(revalidatePath).toHaveBeenCalledWith('/minhas-listas');
});
test('notes use a separate fixed endpoint and clear only when explicitly null or blank', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...CLIENT_PRODUCT, clientNotes: 'Saved' })));
  expect(await saveClientNotes(CLIENT_LIST.id, CLIENT_PRODUCT.id, '  Saved  ')).toMatchObject({ ok: true, data: { clientNotes: 'Saved' } });
  expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:8080/api/client/lists/${CLIENT_LIST.id}/products/${CLIENT_PRODUCT.id}/client-notes`);
  expect(fetchMock.mock.calls[0][1].body).toBe('{"clientNotes":"Saved"}');
  await saveClientNotes(CLIENT_LIST.id, CLIENT_PRODUCT.id, null);
  expect(fetchMock.mock.calls[1][1].body).toBe('{"clientNotes":null}');
});
test.each([undefined, false, [], {}, 'a'.repeat(1001)].map((value) => [value]))('invalid notes %j do not make HTTP requests', async (value) => {
  expect(await saveClientNotes(CLIENT_LIST.id, CLIENT_PRODUCT.id, value)).toMatchObject({ ok: false, status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});
test('invalid purchase values and malformed IDs do not make HTTP requests', async () => {
  expect(await setClientPurchase(CLIENT_LIST.id, CLIENT_PRODUCT.id, 'true')).toMatchObject({ ok: false, status: 400 });
  expect(await setClientPurchase('invalid', CLIENT_PRODUCT.id, true)).toMatchObject({ ok: false, status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});
test('inaccessible products do not trigger invalidation or an administrative fallback', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não encontrado.' }), { status: 404 }));
  expect(await setClientPurchase(CLIENT_LIST.id, CLIENT_PRODUCT.id, true)).toMatchObject({ ok: false, status: 404 });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(revalidatePath).not.toHaveBeenCalled();
});
test('queries use only protected client reads and malformed IDs do not fetch', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([CLIENT_LIST_SUMMARY])))
    .mockResolvedValueOnce(new Response(JSON.stringify(CLIENT_LIST)));
  expect(await getClientLists()).toEqual([CLIENT_LIST_SUMMARY]);
  expect(await getClientList(CLIENT_LIST.id)).toEqual(CLIENT_LIST);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'http://localhost:8080/api/client/lists', `http://localhost:8080/api/client/lists/${CLIENT_LIST.id}`,
  ]);
  await expect(getClientList('invalid')).rejects.toThrow('NEXT_NOT_FOUND');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
