// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Page from './page';
import OfficeManager from '@/components/escritorio/OfficeManager';
import { INVITATION, OFFICE } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, notFound } = vi.hoisted(() => ({
  cookies: vi.fn(),
  fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const API_ORIGIN = 'http://localhost:8080';
const NOW = '2026-11-01T12:00:00.000Z';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'private-jwt' }) });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('the page waits for its protected office read and passes the persisted office', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  const releases = {};
  fetchMock.mockImplementation((url) => new Promise((resolve) => { releases[url] = resolve; }));
  let settled = false;
  const pending = Page().then((page) => { settled = true; return page; });
  await new Promise(setImmediate);

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    API_ORIGIN + '/api/office',
  ]);
  expect(settled).toBe(false);
  for (const [, request] of fetchMock.mock.calls) {
    expect(request.method).toBe('GET');
    expect(request.cache).toBe('no-store');
    expect(request.headers.get('Authorization')).toBe('Bearer private-jwt');
  }
  releases[API_ORIGIN + '/api/office'](json(OFFICE));
  await new Promise(setImmediate);
  const page = await pending;
  const manager = page.props.children.find((child) => child.type === OfficeManager);
  expect(manager?.props).toEqual({ office: OFFICE });
});

test('a page read without a session redirects rather than rendering empty office data', async () => {
  cookies.mockResolvedValue({ get: () => undefined });
  await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a failed office read propagates to the retry boundary without a prototype or empty fallback', async () => {
  fetchMock.mockImplementation(async (url) => url.endsWith('/invitations')
    ? json([INVITATION])
    : json({ detail: 'Tente novamente.', errors: {} }, 503));
  await expect(Page()).rejects.toMatchObject({ status: 503, detail: 'Tente novamente.' });
});

test('an upstream missing office stays a notFound navigation signal', async () => {
  fetchMock.mockImplementation(async (url) => url.endsWith('/invitations')
    ? json([])
    : json({ detail: 'Não encontramos o que você procurava.' }, 404));
  await expect(Page()).rejects.toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledOnce();
});
