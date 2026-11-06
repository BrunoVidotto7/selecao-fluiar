// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { acceptInvitation } from './actions';
import { CLIENT_ME as ME } from '@/test-support/fixtures';

const { cookieStore, cookies, fetchMock, redirect } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  cookies: vi.fn(), fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies, headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

const TOKEN = 'a'.repeat(43);
const API_ORIGIN = 'http://localhost:8080';
const VALUES = { password: 'password123' };
const USER = { ...ME, name: 'Cliente Convidado', email: 'nova@example.com' };
const AUTH = { accessToken: 'invited-jwt', expiresAt: '2026-11-01T12:00:00Z', user: USER };
const INVALID_INPUT = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const json = (body, status = 201) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockReset().mockResolvedValue(cookieStore);
  cookieStore.get.mockReturnValue({ value: 'old-jwt' });
  cookieStore.set.mockReset();
  fetchMock.mockReset().mockImplementation(async () => json(AUTH));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('invitation acceptance cannot choose its office or email', async () => {
  const result = await acceptInvitation(TOKEN, VALUES);
  expect(result).toEqual({ ok: true, data: USER });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    API_ORIGIN + `/api/auth/invitations/${TOKEN}/acceptance`,
    expect.objectContaining({ method: 'POST', body: JSON.stringify(VALUES), cache: 'no-store', redirect: 'error' }),
  );
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(fetchMock.mock.calls[0][1].headers.get('Cookie')).toBeNull();
  expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe('application/json');
});

test('an existing revoked JWT is replaced without being sent to auth', async () => {
  const result = await acceptInvitation(TOKEN, VALUES);
  expect(result).toEqual({ ok: true, data: USER });
  expect(JSON.stringify(result)).not.toContain('invited-jwt');
  expect(JSON.stringify(result)).not.toContain('expiresAt');
  expect(cookieStore.get).not.toHaveBeenCalled();
  expect(cookieStore.set).toHaveBeenCalledExactlyOnceWith('fluiar_session', 'invited-jwt', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: true,
  });
  expect(cookieStore.delete).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.at(-1)[1].headers.get('Authorization')).toBeNull();
  expect(redirect).not.toHaveBeenCalled();
});

test('acceptance returns only the documented user fields even if upstream adds private fields', async () => {
  fetchMock.mockResolvedValue(json({ ...AUTH, user: { ...USER, accessToken: 'nested-private-token', passwordHash: 'private-hash' } }));
  expect(await acceptInvitation(TOKEN, VALUES)).toEqual({ ok: true, data: USER });
  expect(cookieStore.set).toHaveBeenCalledOnce();
});

test.each([null, {}, { ...AUTH, accessToken: '' }, { ...AUTH, user: null }, { ...AUTH, user: { ...USER, email: null } }].map((auth) => [auth]))(
  'malformed auth response %j cannot replace a session or report success', async (auth) => {
    fetchMock.mockResolvedValue(json(auth));
    expect(await acceptInvitation(TOKEN, VALUES)).toEqual({
      ok: false, status: 502, detail: 'A API retornou uma resposta inválida.', errors: {},
    });
    expect(cookies).not.toHaveBeenCalled();
  },
);

test('acceptance preserves raw non-ASCII passwords and surrounding spaces', async () => {
  await acceptInvitation(TOKEN, { ...VALUES, password: '  Sênha1234 🔑  ' });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ password: '  Sênha1234 🔑  ' });
});

test.each([undefined, null, [], [TOKEN], {}, '', 'a'.repeat(42), 'a'.repeat(44), '/'.repeat(43), TOKEN + '\n'].map((token) => [token]))(
  'acceptance rejects malformed token %j before HTTP or session access', async (token) => {
    expect(await acceptInvitation(token, VALUES)).toEqual(INVALID_INPUT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  },
);

test.each([
  undefined, null, [], 'body', 123, {},
  { ...VALUES, name: null }, { ...VALUES, name: [] }, { ...VALUES, name: 123 },
  { ...VALUES, password: null }, { ...VALUES, password: [] }, { ...VALUES, password: 123 },
].map((input) => [input]))('acceptance rejects malformed body %j before HTTP or session access', async (input) => {
  expect(await acceptInvitation(TOKEN, input)).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test.each([
  ['revoked/expired/used link', 400, 'Este link expirou ou já foi usado. Peça um novo.', {}],
  ['duplicate account', 409, 'Este e-mail já tem uma conta.', { email: 'Este e-mail já tem uma conta.' }],
  ['validation', 400, 'Revise os campos destacados.', { name: 'Preencha este campo.', password: 'Use entre 8 e 72 caracteres.' }],
  ['rate limit', 429, 'Muitas tentativas. Tente novamente em alguns minutos.', {}],
  ['upstream error', 503, 'Algo deu errado do nosso lado. Tente novamente em alguns minutos.', {}],
])('%s returns the API failure without replacing the existing session', async (_, status, detail, errors) => {
  fetchMock.mockResolvedValue(json({ type: 'about:blank', status, detail, errors }, status));
  expect(await acceptInvitation(TOKEN, VALUES)).toEqual({ ok: false, status, detail, errors });
  expect(cookies).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test.each(['network', 'non-JSON proxy'])('%s failure is safe and leaves the previous session intact', async (failure) => {
  if (failure === 'network') fetchMock.mockRejectedValue(new TypeError('private network details'));
  else fetchMock.mockResolvedValue(new Response('<html>private proxy details</html>', { status: 502 }));
  expect(await acceptInvitation(TOKEN, VALUES)).toEqual({
    ok: false, status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.', errors: {},
  });
  expect(cookies).not.toHaveBeenCalled();
});

test('acceptance preserves navigation signals without creating a session', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(acceptInvitation(TOKEN, VALUES)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(cookieStore.set).not.toHaveBeenCalled();
});

test('unexpected cookie-write failures propagate instead of reporting acceptance success', async () => {
  const failure = new Error('session unavailable');
  cookieStore.set.mockImplementationOnce(() => { throw failure; });
  await expect(acceptInvitation(TOKEN, VALUES)).rejects.toBe(failure);
});

test('acceptance waits for the new session before reporting success', async () => {
  let release;
  cookies.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let settled = false;
  const pending = acceptInvitation(TOKEN, VALUES).then((value) => { settled = true; return value; });
  await new Promise(setImmediate);
  expect(cookies).toHaveBeenCalledOnce();
  expect(settled).toBe(false);
  release(cookieStore);
  expect(await pending).toEqual({ ok: true, data: USER });
});
