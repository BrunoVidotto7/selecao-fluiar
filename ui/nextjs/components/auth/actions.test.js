// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { login, logout, signup } from './actions';
import { ME } from '@/test-support/fixtures';

const { cookieStore, cookies, fetchMock, redirect } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  cookies: vi.fn(),
  fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn() }));

const API_ORIGIN = 'http://localhost:8080';
const EXPIRES_AT = '2026-11-30T12:00:00Z';
const INVALID_INPUT = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const LOGIN_VALUES = { email: ME.email, password: 'password123', rememberMe: true };
const SIGNUP_VALUES = { name: ME.name, email: ME.email, password: 'password123' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  cookies.mockReset().mockResolvedValue(cookieStore);
  fetchMock.mockReset().mockImplementation(async () => json({ accessToken: 'jwt', expiresAt: EXPIRES_AT, user: ME }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test.each([true, false])('login stores its token privately with rememberMe=%s', async (rememberMe) => {
  const result = await login({ ...LOGIN_VALUES, rememberMe, officeId: ME.officeId, accessToken: 'injected' });

  expect(result).toEqual({ ok: true, data: ME });
  expect(JSON.stringify(result)).not.toContain('jwt');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/auth/login', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ email: ME.email, password: 'password123', rememberMe }),
    cache: 'no-store', redirect: 'error',
  }));
  const { headers } = fetchMock.mock.calls[0][1];
  expect(headers.get('Authorization')).toBeNull();
  expect(headers.get('Cookie')).toBeNull();
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(cookieStore.get).not.toHaveBeenCalled();
  expect(cookieStore.set).toHaveBeenCalledExactlyOnceWith('fluiar_session', 'jwt', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: true,
    ...(rememberMe ? { expires: new Date(EXPIRES_AT) } : {}),
  });
  expect(redirect).not.toHaveBeenCalled();
});

test('signup whitelists its body and writes a session cookie before returning only the user', async () => {
  fetchMock.mockResolvedValue(json({ accessToken: 'jwt', expiresAt: EXPIRES_AT, user: ME }, 201));
  const result = await signup({
    ...SIGNUP_VALUES, passwordConfirmation: 'ignored', rememberMe: true, userId: ME.id, officeId: ME.officeId,
  });

  expect(result).toEqual({ ok: true, data: ME });
  expect(JSON.stringify(result)).not.toContain('jwt');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/auth/signup', expect.objectContaining({
    method: 'POST', body: JSON.stringify(SIGNUP_VALUES), cache: 'no-store',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(fetchMock.mock.calls[0][1].headers.get('Cookie')).toBeNull();
  expect(cookieStore.get).not.toHaveBeenCalled();
  expect(cookieStore.set).toHaveBeenCalledExactlyOnceWith('fluiar_session', 'jwt', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: true,
  });
});

test.each([['login', login, LOGIN_VALUES], ['signup', signup, SIGNUP_VALUES]])(
  '%s preserves leading/trailing spaces and non-ASCII password characters', async (_, action, values) => {
    await action({ ...values, password: '  Sênha1234 🔑  ' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).password).toBe('  Sênha1234 🔑  ');
  },
);

const malformedInputs = [undefined, null, [], 'body', 123, {}, { email: null, password: 'password123' },
  { email: ['ana@example.com'], password: 'password123' }, { email: ME.email, password: 123 },
  { email: ME.email, password: {} }];

test.each(malformedInputs.map((input) => [input]))('login rejects malformed input %j without HTTP or cookie writes', async (input) => {
  expect(await login(input)).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test.each([undefined, null, 'false', 0, []].map((input) => [input]))('login rejects a non-boolean rememberMe: %j', async (rememberMe) => {
  expect(await login({ ...LOGIN_VALUES, rememberMe })).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test.each([...malformedInputs, { ...SIGNUP_VALUES, name: null }, { ...SIGNUP_VALUES, name: [] }].map((input) => [input]))(
  'signup rejects malformed input %j without HTTP or cookie writes', async (input) => {
    expect(await signup(input)).toEqual(INVALID_INPUT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  },
);

test.each([
  { ...SIGNUP_VALUES, email: null }, { ...SIGNUP_VALUES, email: [] },
  { ...SIGNUP_VALUES, password: null }, { ...SIGNUP_VALUES, password: [] },
  { ...SIGNUP_VALUES, password: 123 },
])('signup rejects non-string fields even when name is valid: %j', async (input) => {
  expect(await signup(input)).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test.each([
  ['login credentials', login, LOGIN_VALUES, 401, 'E-mail ou senha incorretos.', {}],
  ['login rate limit', login, LOGIN_VALUES, 429, 'Muitas tentativas. Tente novamente em alguns minutos.', {}],
  ['signup conflict', signup, SIGNUP_VALUES, 409, 'Este e-mail já tem uma conta.', { email: 'Este e-mail já tem uma conta.' }],
  ['signup validation', signup, SIGNUP_VALUES, 400, 'Revise os dados enviados.', { name: 'Preencha este campo.' }],
])('%s preserves API detail and field errors without creating a session', async (_, action, values, status, detail, errors) => {
  fetchMock.mockResolvedValue(json({ type: 'about:blank', status, detail, errors }, status));
  expect(await action(values)).toEqual({ ok: false, status, detail, errors });
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test('transport failure returns safe feedback and does not create a session', async () => {
  fetchMock.mockRejectedValue(new TypeError('private network details'));
  expect(await login(LOGIN_VALUES)).toEqual({
    ok: false, status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.', errors: {},
  });
  expect(cookieStore.set).not.toHaveBeenCalled();
});

test('unexpected session failures remain exceptions instead of reported success or an API failure', async () => {
  const failure = new Error('session unavailable');
  cookieStore.set.mockImplementationOnce(() => { throw failure; });
  await expect(login(LOGIN_VALUES)).rejects.toBe(failure);
});

test.each([['login', login, LOGIN_VALUES], ['signup', signup, SIGNUP_VALUES]])(
  '%s waits for the private session to be writable before returning success', async (_, action, values) => {
    let releaseCookies;
    cookies.mockImplementationOnce(() => new Promise((resolve) => { releaseCookies = resolve; }));
    let settled = false;
    const result = action(values).then((value) => { settled = true; return value; });
    await new Promise(setImmediate);
    expect(cookies).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    releaseCookies(cookieStore);
    expect(await result).toEqual({ ok: true, data: ME });
    expect(cookieStore.set).toHaveBeenCalledOnce();
  },
);

test('a navigation signal remains a navigation signal', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(signup(SIGNUP_VALUES)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookieStore.set).not.toHaveBeenCalled();
});

test('logout clears the cookie before redirecting without an API request', async () => {
  await expect(logout()).rejects.toThrow('NEXT_REDIRECT');
  expect(cookieStore.delete).toHaveBeenCalledExactlyOnceWith('fluiar_session');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookieStore.delete.mock.invocationCallOrder[0]).toBeLessThan(redirect.mock.invocationCallOrder[0]);
  expect(fetchMock).not.toHaveBeenCalled();
});
