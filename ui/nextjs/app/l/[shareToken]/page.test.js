import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import Page from './page';
import { LIST } from '@/test-support/fixtures';
const { fetchMock, cookieStore, redirect, notFound } = vi.hoisted(() => ({
  fetchMock: vi.fn(), cookieStore: { get: vi.fn() },
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
const page = (token = LIST.shareToken) => Page({ params: Promise.resolve({ shareToken: token }) });
beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: 'jwt' });
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ listId: LIST.id, role: 'CLIENT' })));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('an owner is directed to their private client list', async () => {
  await expect(page()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/minhas-listas/' + LIST.id);
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer jwt');
});
test('missing and revoked sessions preserve a safe local share return path', async () => {
  const target = '/login?next=' + encodeURIComponent('/l/' + LIST.shareToken);
  cookieStore.get.mockReturnValue(undefined);
  await expect(page()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith(target);
  expect(fetchMock).not.toHaveBeenCalled();
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(page()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenLastCalledWith(target);
});
test('admins go to the administrative list after ownership resolution', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ listId: LIST.id, role: 'ADMIN' })));
  await expect(page()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/listas/' + LIST.id);
});
test('invalid tokens never make an API request', async () => {
  await expect(page('invalid')).rejects.toThrow('NEXT_NOT_FOUND');
  expect(fetchMock).not.toHaveBeenCalled();
});
test('a forbidden or removed list remains not found', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não encontrado.' }), { status: 404 }));
  await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
  expect(redirect).not.toHaveBeenCalled();
});
