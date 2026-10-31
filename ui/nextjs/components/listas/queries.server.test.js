// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cache } from 'react';
import { getList } from './queries.server';
import { LIST } from '@/test-support/fixtures';

const { cookies, fetchMock, notFound, redirect } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal();
  return { ...react, cache: vi.fn(react.cache) };
});
const cachedFunctions = cache.mock.results.map(({ value }) => value);

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'first-jwt' }) });
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify(LIST)));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('getList returns the complete persisted DTO using the private list endpoint', async () => {
  expect(await getList(LIST.id)).toEqual(LIST);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/api/lists/' + LIST.id,
    expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer first-jwt');
});

test.each([undefined, null, [], 'slug', LIST.id + '/other', LIST.id + '\n'].map((id) => [id]))(
  'getList refuses malformed ID %j before any request', async (id) => {
    await expect(getList(id)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  },
);

test('a foreign or deleted list 404 becomes page notFound', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não encontramos o que você procurava.' }), { status: 404 }));
  await expect(getList(LIST.id)).rejects.toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledOnce();
});

test('a read outage is not converted into an empty list or a 404', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Tente novamente.' }), { status: 503 }));
  await expect(getList(LIST.id)).rejects.toMatchObject({ status: 503, detail: 'Tente novamente.' });
  expect(notFound).not.toHaveBeenCalled();
});

test('the exported read is React request-cached, not a global list or session cache', async () => {
  const changedList = { ...LIST, name: 'Outra casa' };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(LIST)))
    .mockResolvedValueOnce(new Response(JSON.stringify(changedList)));
  expect(await getList(LIST.id)).toEqual(LIST);
  cookies.mockResolvedValue({ get: () => ({ value: 'second-jwt' }) });
  expect(await getList(LIST.id)).toEqual(changedList);
  expect(fetchMock.mock.calls.map(([, options]) => options.headers.get('Authorization')))
    .toEqual(['Bearer first-jwt', 'Bearer second-jwt']);
  // Outside an RSC request, React.cache deliberately does not memoize.
  expect(cachedFunctions).toContain(getList);
});
