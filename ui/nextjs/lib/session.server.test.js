// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { clearSession, getAccessToken, setSession } from './session.server';

const { cookieStore, cookies } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  cookies: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies }));

const AUTH_RESPONSE = { accessToken: 'jwt', expiresAt: '2026-11-30T12:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue(cookieStore);
  cookieStore.get.mockReturnValue(undefined);
  vi.stubEnv('NODE_ENV', 'development');
});
afterEach(() => vi.unstubAllEnvs());

test('the cookie hides the JWT and follows remember-me expiry', async () => {
  await setSession(AUTH_RESPONSE, { persistent: true });
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session', 'jwt', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: false,
    expires: new Date('2026-11-30T12:00:00Z'),
  });
});

test.each([undefined, { persistent: false }])('a browser session has no expires or maxAge with options %j', async (options) => {
  await setSession(AUTH_RESPONSE, options);
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session', 'jwt', {
    httpOnly: true, sameSite: 'lax', path: '/', secure: false,
  });
});

test('the cookie is secure in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await setSession(AUTH_RESPONSE);
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session', 'jwt', expect.objectContaining({ secure: true }));
});

test('getAccessToken awaits and reads the current request cookie without writing', async () => {
  cookieStore.get.mockReturnValueOnce({ value: 'first-jwt' }).mockReturnValueOnce({ value: 'second-jwt' });
  expect(await getAccessToken()).toBe('first-jwt');
  expect(await getAccessToken()).toBe('second-jwt');
  expect(cookieStore.get).toHaveBeenCalledWith('fluiar_session');
  expect(cookies).toHaveBeenCalledTimes(2);
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('getAccessToken returns null without a session', async () => {
  expect(await getAccessToken()).toBeNull();
});

test('clearSession deletes only the session cookie', async () => {
  await clearSession();
  expect(cookieStore.delete).toHaveBeenCalledExactlyOnceWith('fluiar_session');
  expect(cookieStore.set).not.toHaveBeenCalled();
});
