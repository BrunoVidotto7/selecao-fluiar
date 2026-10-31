// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { changePassword, updateProfile } from './actions';
import { getCurrentUser } from '@/lib/api.server';
import { ME } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, revalidatePath } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }), revalidatePath: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({
  redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/cache', () => ({ revalidatePath }));

const API_ORIGIN = 'http://localhost:8080';
const SAVED_USER = { ...ME, name: 'Ana Reis', email: 'new@example.com' };
const PROFILE_INPUT = { name: 'Ana Reis', email: 'new@example.com', currentPassword: 'oldPassword' };
const PASSWORD_INPUT = { currentPassword: 'oldPassword', newPassword: ' newPassword123 ' };
const AUTH_RESPONSE = { accessToken: 'new-jwt', expiresAt: '2026-10-31T22:00:00Z', user: ME };
const INVALID_INPUT = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
let token;
let cookieStore;

beforeEach(() => {
  vi.clearAllMocks();
  token = 'old-jwt';
  cookieStore = {
    get: vi.fn(() => ({ value: token })),
    set: vi.fn((name, value) => { token = value; }),
    delete: vi.fn(),
  };
  cookies.mockReset().mockResolvedValue(cookieStore);
  fetchMock.mockReset().mockResolvedValue(json(SAVED_USER));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
  vi.stubEnv('NODE_ENV', 'development');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('profile returns only persisted identity and writes a whitelisted body to the authenticated account', async () => {
  fetchMock.mockResolvedValue(json({ ...SAVED_USER, accessToken: 'leaked', password: 'secret' }));
  expect(await updateProfile({ ...PROFILE_INPUT, officeId: 'injected', userId: 'injected', token: 'injected' }))
    .toEqual({ ok: true, data: SAVED_USER });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/me', expect.objectContaining({
    method: 'PUT', body: JSON.stringify(PROFILE_INPUT), cache: 'no-store', redirect: 'error',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer old-jwt');
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(revalidatePath.mock.calls).toEqual([['/(app)', 'layout'], ['/listas/[id]', 'layout']]);
});

test.each([
  [{ name: 'Ana Reis', email: ME.email }],
  [{ name: 'Ana Reis', email: ' ANA@EXAMPLE.COM ', currentPassword: undefined }],
])('a profile request without an email confirmation omits currentPassword: %j', async (input) => {
  expect(await updateProfile(input)).toEqual({ ok: true, data: SAVED_USER });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: input.name, email: input.email });
});

test('changing password replaces a remembered cookie before returning sanitized identity and the next protected read', async () => {
  fetchMock.mockResolvedValueOnce(json({
    ...AUTH_RESPONSE, password: 'secret', user: { ...ME, accessToken: 'nested-jwt', password: 'secret' },
  })).mockResolvedValueOnce(json(ME));
  const result = await changePassword({ ...PASSWORD_INPUT, officeId: 'injected', rememberMe: true, path: '/api/other' });
  expect(result).toEqual({ ok: true, data: ME });
  expect(JSON.stringify(result)).not.toMatch(/jwt|Password|password|expiresAt|accessToken/);
  expect(fetchMock.mock.calls[0][0]).toBe(API_ORIGIN + '/api/me/password');
  expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
    method: 'PUT', body: JSON.stringify(PASSWORD_INPUT), cache: 'no-store', redirect: 'error',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer old-jwt');
  expect(cookieStore.set).toHaveBeenCalledExactlyOnceWith('fluiar_session', 'new-jwt', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: false,
  });
  expect(await getCurrentUser()).toEqual(ME);
  expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer new-jwt');
  expect(revalidatePath.mock.calls).toEqual([['/(app)', 'layout']]);
});

test('password result waits for the asynchronous cookie store before it can settle', async () => {
  let releaseCookies;
  cookies.mockResolvedValueOnce(cookieStore).mockImplementationOnce(() => new Promise((resolve) => { releaseCookies = resolve; }));
  fetchMock.mockResolvedValueOnce(json(AUTH_RESPONSE));
  let settled = false;
  const pending = changePassword(PASSWORD_INPUT).then((result) => { settled = true; return result; });
  await new Promise(setImmediate);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(settled).toBe(false);
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
  releaseCookies(cookieStore);
  expect(await pending).toEqual({ ok: true, data: ME });
  expect(cookieStore.set).toHaveBeenCalledOnce();
});

const malformedBodies = [undefined, null, [], 'body', 123, true, {}];
test.each([
  ...malformedBodies.map((input) => ['profile', updateProfile, input]),
  ...malformedBodies.map((input) => ['password', changePassword, input]),
  ...['name', 'email', 'currentPassword'].flatMap((field) => [null, [], {}, 123, false].map((value) => [
    'profile ' + field, updateProfile, { ...PROFILE_INPUT, [field]: value },
  ])),
  ...['currentPassword', 'newPassword'].flatMap((field) => [undefined, null, [], {}, 123, false].map((value) => [
    'password ' + field, changePassword, { ...PASSWORD_INPUT, [field]: value },
  ])),
])('%s rejects malformed input %j before any protected write', async (_, action, input) => {
  expect(await action(input)).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  ['profile', updateProfile, PROFILE_INPUT],
  ['password', changePassword, PASSWORD_INPUT],
])('%s without a session preserves login navigation', async (_, action, input) => {
  cookieStore.get.mockReturnValue(undefined);
  await expect(action(input)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  ['profile', updateProfile, PROFILE_INPUT],
  ['password', changePassword, PASSWORD_INPUT],
])('%s with revoked credentials redirects without reporting success', async (_, action, input) => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(action(input)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  ['profile wrong password', updateProfile, PROFILE_INPUT, 400, 'Revise os campos destacados.', { currentPassword: 'Senha atual incorreta.' }],
  ['duplicate email', updateProfile, PROFILE_INPUT, 409, 'Este e-mail já tem uma conta.', { email: 'Este e-mail já tem uma conta.' }],
  ['profile rate limit', updateProfile, PROFILE_INPUT, 429, 'Muitas tentativas. Tente novamente em alguns minutos.', {}],
  ['password wrong password', changePassword, PASSWORD_INPUT, 400, 'Revise os campos destacados.', { currentPassword: 'Senha atual incorreta.' }],
  ['password byte validation', changePassword, PASSWORD_INPUT, 400, 'Revise os campos destacados.', { newPassword: 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.' }],
  ['password rate limit', changePassword, PASSWORD_INPUT, 429, 'Muitas tentativas. Tente novamente em alguns minutos.', {}],
  ['missing account', updateProfile, PROFILE_INPUT, 404, 'Não encontramos o que você procurava.', {}],
])('%s retains exact upstream errors without replacing the session or invalidating', async (_, action, input, status, detail, errors) => {
  fetchMock.mockResolvedValue(json({ type: 'about:blank', status, detail, errors }, status));
  expect(await action(input)).toEqual({ ok: false, status, detail, errors });
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('transport errors stay actionable and unexpected configuration errors are not swallowed', async () => {
  fetchMock.mockRejectedValue(new TypeError('network failed'));
  expect(await changePassword(PASSWORD_INPUT)).toEqual({
    ok: false, status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.', errors: {},
  });
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'invalid');
  await expect(updateProfile(PROFILE_INPUT)).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});
