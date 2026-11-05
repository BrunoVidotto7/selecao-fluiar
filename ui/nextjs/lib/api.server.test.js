// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cache } from 'react';
import { actionResult, ApiError, apiRequest, getCurrentUser, readApi } from './api.server';
import { revalidateWorkspaceData } from './revalidate.server';
import { CLIENT, DASHBOARD, LIST, ME, PRODUCT, PUBLIC_LIST, ROOM, SECOND_PRODUCT, SECOND_ROOM } from '@/test-support/fixtures';

const { cookieStore, cookies, fetchMock, redirect, notFound, revalidatePath } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  cookies: vi.fn(),
  fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  revalidatePath: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal();
  return { ...react, cache: vi.fn(react.cache) };
});

const API_ORIGIN = 'http://localhost:8080';
const CONNECTION_DETAIL = 'Não conseguimos conectar à API. Tente novamente.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';
const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const cachedCurrentUser = cache.mock.results[0]?.value;

beforeEach(() => {
  cookieStore.get.mockReset().mockReturnValue({ value: 'jwt' });
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookies.mockReset().mockResolvedValue(cookieStore);
  fetchMock.mockReset().mockImplementation(async () => json(ME));
  redirect.mockClear();
  notFound.mockClear();
  revalidatePath.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('a protected request forwards the current JWT with no-store and refuses upstream redirects', async () => {
  expect(await apiRequest('/api/me')).toEqual(ME);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/me', {
    method: 'GET', headers: expect.any(Headers), body: undefined,
    cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
  });
  const { headers } = fetchMock.mock.calls[0][1];
  expect(headers.get('Authorization')).toBe('Bearer jwt');
  expect(headers.get('Content-Type')).toBeNull();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('public requests ignore even a revoked cookie', async () => {
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  fetchMock.mockResolvedValue(json({ email: ME.email }));
  await apiRequest('/api/auth/password-resets/' + 'a'.repeat(43), { auth: 'public' });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(cookies).not.toHaveBeenCalled();
});

test.each(['/api/auth/login', '/api/auth/password-reset-requests'])(
  'public namespace %s ignores the default required authentication', async (path) => {
    cookieStore.get.mockReturnValue(undefined);
    await apiRequest(path);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
    expect(cookies).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  },
);

test('a protected request with no cookie redirects without a fetch or session write', async () => {
  cookieStore.get.mockReturnValue(undefined);
  await expect(apiRequest('/api/me')).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('a protected 401 redirects even when its body is empty', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(apiRequest('/api/me')).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test.each(['/api/me', '/api/auth/signup', '/api/auth/password-resets', '/api/public/lists/' + LIST.shareToken])(
  'a non-login 401 redirects before parsing even an HTML response: %s', async (path) => {
    fetchMock.mockResolvedValue(new Response('<html>Unauthorized</html>', { status: 401 }));
    await expect(apiRequest(path, { method: 'POST' })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  },
);

test('a rejected POST login returns the expected error instead of redirecting back to login', async () => {
  fetchMock.mockResolvedValue(json({ detail: INVALID_CREDENTIALS }, 401));
  expect(await actionResult(() => apiRequest('/api/auth/login', {
    method: 'POST', body: { email: ME.email, password: 'incorrect' },
  }))).toEqual({ ok: false, status: 401, detail: INVALID_CREDENTIALS, errors: {} });
  expect(redirect).not.toHaveBeenCalled();
});

test('the login exception applies only to POST', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(apiRequest('/api/auth/login')).rejects.toThrow('NEXT_REDIRECT');
});

test('different request cookies produce different Bearer headers', async () => {
  cookieStore.get.mockReturnValueOnce({ value: 'first-jwt' }).mockReturnValueOnce({ value: 'second-jwt' });
  await apiRequest('/api/me');
  await apiRequest('/api/me');
  expect(fetchMock.mock.calls.map(([, options]) => options.headers.get('Authorization')))
    .toEqual(['Bearer first-jwt', 'Bearer second-jwt']);
});

test.each([undefined, '', 'not a URL', 'ftp://localhost:8080', API_ORIGIN + '/api', API_ORIGIN + '?x=1', 'http://user:password@localhost:8080'])(
  'invalid API configuration fails clearly before fetch: %j', async (origin) => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', origin);
    await expect(apiRequest('/api/me')).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each([API_ORIGIN, API_ORIGIN + '/', 'https://api.example.com/'])(
  'the configured HTTP(S) origin normalizes its trailing slash: %s', async (origin) => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', origin);
    await apiRequest('/api/me');
    expect(fetchMock.mock.calls[0][0]).toBe(origin.replace(/\/$/, '') + '/api/me');
  },
);

test.each(['https://evil.example/api/me', API_ORIGIN + '/api/me', '//evil.example/api/me', '/\\evil.example/api/me', 'api/me', '', null, '/api/me\n'])(
  'absolute, off-origin or malformed paths are rejected before fetch: %j', async (path) => {
    await expect(apiRequest(path)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  },
);

test('public-prefix traversal cannot make a protected target anonymous', async () => {
  await apiRequest('/api/auth/../me');
  expect(fetchMock.mock.calls[0][0]).toBe(API_ORIGIN + '/api/me');
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer jwt');
});

test('JSON requests serialize only their body and set Content-Type', async () => {
  const body = { name: CLIENT.name, email: CLIENT.email };
  await apiRequest('/api/clients', { method: 'POST', body });
  const options = fetchMock.mock.calls[0][1];
  expect(options.method).toBe('POST');
  expect(options.body).toBe(JSON.stringify(body));
  expect(options.headers.get('Content-Type')).toBe('application/json');
  expect(options.cache).toBe('no-store');
});

test('multipart requests keep FormData intact without setting Content-Type', async () => {
  const body = new FormData();
  body.set('file', new Blob(['image'], { type: 'image/png' }), 'image.png');
  await apiRequest('/api/products/' + PRODUCT.id + '/image', { method: 'POST', body });
  const options = fetchMock.mock.calls[0][1];
  expect(options.body).toBe(body);
  expect(options.headers.get('Content-Type')).toBeNull();
  expect(options.cache).toBe('no-store');
});

test('requests use a 15-second timeout signal', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  await apiRequest('/api/me');
  expect(timeout).toHaveBeenCalledExactlyOnceWith(15000);
  expect(fetchMock.mock.calls[0][1].signal).toBe(timeout.mock.results[0].value);
});

test('a successful bodyless response does not attempt JSON parsing', async () => {
  const response = new Response(null, { status: 204 });
  const parseJson = vi.spyOn(response, 'json');
  fetchMock.mockResolvedValue(response);
  expect(await apiRequest('/api/clients/' + CLIENT.id, { method: 'DELETE' })).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(parseJson).not.toHaveBeenCalled();
});

test('an empty 202 response returns undefined', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
  expect(await apiRequest('/api/auth/password-reset-requests', { method: 'POST', body: { email: ME.email } })).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledOnce();
});

test.each([400, 409, 429])('HTTP %s preserves ProblemDetail detail and field errors', async (status) => {
  const problem = { detail: 'Revise os dados enviados.', errors: { name: 'Preencha este campo.' } };
  fetchMock.mockResolvedValue(json(problem, status));
  await expect(apiRequest('/api/clients', { method: 'POST', body: {} }))
    .rejects.toMatchObject({ status, detail: problem.detail, message: problem.detail, errors: problem.errors });
});

test('an HTML 502 becomes a safe connection error', async () => {
  fetchMock.mockResolvedValue(new Response('<html>proxy detail</html>', { status: 502 }));
  await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 503, detail: CONNECTION_DETAIL, errors: {} });
});

test.each([new TypeError('network detail'), new DOMException('timed out', 'TimeoutError')])(
  'a rejected fetch or timeout becomes a safe connection error: %s', async (error) => {
    fetchMock.mockRejectedValue(error);
    await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 503, detail: CONNECTION_DETAIL, errors: {} });
  },
);

test('a timeout while consuming the response also becomes a connection error', async () => {
  const response = json(ME);
  vi.spyOn(response, 'text').mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
  fetchMock.mockResolvedValue(response);
  await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 503, detail: CONNECTION_DETAIL });
});

test('malformed successful JSON becomes an invalid-response error', async () => {
  fetchMock.mockResolvedValue(new Response('not JSON'));
  await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 502, detail: INVALID_RESPONSE_DETAIL, errors: {} });
});

describe('readApi', () => {
  test('a resource 404 becomes notFound', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Registro não encontrado.' }, 404));
    await expect(readApi('/api/clients/' + CLIENT.id)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  test('successful data is returned and other errors are rethrown', async () => {
    expect(await readApi('/api/me')).toEqual(ME);
    fetchMock.mockResolvedValue(json({ detail: 'Tente novamente.' }, 429));
    await expect(readApi('/api/me')).rejects.toMatchObject({ status: 429, detail: 'Tente novamente.' });
    expect(notFound).not.toHaveBeenCalled();
  });

  test('public invalid-link pages can handle 404 directly through apiRequest', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Link inválido.' }, 404));
    await expect(apiRequest('/api/auth/password-resets/' + LIST.shareToken, { auth: 'public' }))
      .rejects.toMatchObject({ status: 404, detail: 'Link inválido.' });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('actionResult', () => {
  test('successful work returns serializable data', async () => {
    expect(await actionResult(async () => CLIENT)).toEqual({ ok: true, data: CLIENT });
    expect(await actionResult(async () => undefined)).toEqual({ ok: true, data: undefined });
  });

  test('only ApiError becomes a typed expected failure', async () => {
    const errors = { name: 'Preencha este campo.' };
    expect(await actionResult(async () => { throw new ApiError(400, 'Revise os dados enviados.', errors); }))
      .toEqual({ ok: false, status: 400, detail: 'Revise os dados enviados.', errors });
  });

  test.each(['NEXT_REDIRECT', 'NEXT_NOT_FOUND', 'programming error'])('it does not swallow %s', async (message) => {
    const error = new Error(message);
    await expect(actionResult(async () => { throw error; })).rejects.toBe(error);
  });
});

test('getCurrentUser is wrapped in React.cache without retaining users between requests', async () => {
  cookieStore.get.mockReturnValueOnce({ value: 'first-jwt' }).mockReturnValueOnce({ value: 'second-jwt' });
  fetchMock.mockResolvedValueOnce(json(ME)).mockResolvedValueOnce(json({ ...ME, name: 'Outra pessoa' }));
  expect(await getCurrentUser()).toEqual(ME);
  expect(await getCurrentUser()).toEqual({ ...ME, name: 'Outra pessoa' });
  expect(fetchMock.mock.calls.map(([url, options]) => [url, options.headers.get('Authorization')])).toEqual([
    [API_ORIGIN + '/api/me', 'Bearer first-jwt'], [API_ORIGIN + '/api/me', 'Bearer second-jwt'],
  ]);
  expect(cachedCurrentUser).toBe(getCurrentUser);
});

test('getCurrentUser redirects a revoked session without exposing user data or writing cookies', async () => {
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(getCurrentUser()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('workspace revalidation invalidates only the shared private views', () => {
  revalidateWorkspaceData();
  expect(revalidatePath.mock.calls).toEqual([
    ['/dashboard'], ['/minhas-listas'], ['/minhas-listas/[id]', 'layout'], ['/clientes'], ['/clientes/[id]', 'layout'], ['/listas'], ['/listas/[id]', 'layout'],
  ]);
});

test('fixtures use the complete API shapes and expose only the public subset in PUBLIC_LIST', () => {
  expect(LIST.rooms).toEqual([ROOM]);
  expect(ROOM.products).toEqual([PRODUCT]);
  expect(PRODUCT).toMatchObject({ quantity: 2, unitPrice: 12.50, bought: false });
  expect(SECOND_ROOM.id).toBe('33333333-3333-4333-8333-333333335555');
  expect(SECOND_PRODUCT.id).toBe('44444444-4444-4444-8444-444444446666');
  expect(SECOND_ROOM.products).toEqual([SECOND_PRODUCT]);
  expect(CLIENT.phone).toBe('31999998888');
  expect(DASHBOARD.recentLists[0].completed).toBe(false);
  expect(PUBLIC_LIST).toEqual({
    name: LIST.name,
    description: LIST.description,
    rooms: [{ name: 'Cozinha', products: [{ name: 'Batedeira', quantity: 2, bought: false, links: PRODUCT.links }] }],
    signature: { officeName: ME.officeName, architectNames: [ME.name] },
  });
});

test('an unauthenticated shared-link request retains only a validated local return path', async () => {
  cookieStore.get.mockReturnValue(undefined);
  const target = '/l/' + 'a'.repeat(43);
  await expect(apiRequest('/api/public/lists/' + 'a'.repeat(43), { returnTo: target })).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login?next=' + encodeURIComponent(target));
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['/api/public/lists/' + LIST.shareToken, '/api/images/' + PRODUCT.id])('private resource %s requires a session', async (path) => {
  cookieStore.get.mockReturnValue(undefined);
  await expect(apiRequest(path)).rejects.toThrow('NEXT_REDIRECT');
  expect(fetchMock).not.toHaveBeenCalled();
});
