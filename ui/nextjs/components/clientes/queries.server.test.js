// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cache } from 'react';
import { getClient } from './queries.server';
import { CLIENT } from '@/test-support/fixtures';

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
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify(CLIENT)));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('getClient returns the complete persisted detail and API list summaries', async () => {
  expect(await getClient(CLIENT.id)).toEqual(CLIENT);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/api/clients/' + CLIENT.id,
    expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer first-jwt');
});

test.each([undefined, null, [], 'slug', CLIENT.id + '/other', CLIENT.id + '\n'].map((id) => [id]))(
  'getClient rejects malformed ID %j before any request', async (id) => {
    await expect(getClient(id)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  },
);

test('another office client 404 becomes notFound', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não encontramos o que você procurava.' }), { status: 404 }));
  await expect(getClient(CLIENT.id)).rejects.toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledOnce();
});

test('a read outage propagates instead of returning a synthetic empty client', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Tente novamente.' }), { status: 503 }));
  await expect(getClient(CLIENT.id)).rejects.toMatchObject({ status: 503, detail: 'Tente novamente.' });
  expect(notFound).not.toHaveBeenCalled();
});

test('getClient uses React request caching without retaining another session DTO globally', async () => {
  const changed = { ...CLIENT, name: 'Outra pessoa', lists: [] };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(CLIENT)))
    .mockResolvedValueOnce(new Response(JSON.stringify(changed)));
  expect(await getClient(CLIENT.id)).toEqual(CLIENT);
  cookies.mockResolvedValue({ get: () => ({ value: 'second-jwt' }) });
  expect(await getClient(CLIENT.id)).toEqual(changed);
  expect(fetchMock.mock.calls.map(([, options]) => options.headers.get('Authorization')))
    .toEqual(['Bearer first-jwt', 'Bearer second-jwt']);
  // Outside an RSC request React.cache deliberately does not memoize.
  expect(cachedFunctions).toContain(getClient);
});
