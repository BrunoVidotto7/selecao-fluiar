// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { renameOffice } from './actions';
import { OFFICE } from '@/test-support/fixtures';
const { cookies, fetchMock, revalidatePath, redirect } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath }));
beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'jwt' }) });
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...OFFICE, name: 'Ateliê Ana' })));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('office rename persists only its name using the authenticated office', async () => {
  expect(await renameOffice({ name: 'Ateliê Ana', officeId: 'injected' })).toEqual({ ok: true, data: { ...OFFICE, name: 'Ateliê Ana' } });
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/office');
  expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ name: 'Ateliê Ana' }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer jwt');
  expect(revalidatePath).toHaveBeenCalledWith('/(app)', 'layout');
});
test.each([undefined, null, [], {}, 'body', { name: null }, { name: [] }].map((input) => [input]))('invalid rename input %j has no side effects', async (input) => {
  expect(await renameOffice(input)).toMatchObject({ ok: false, status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});
test('API failures preserve feedback and never invalidate after failure', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Tente novamente.', errors: { name: 'Inválido.' } }), { status: 400 }));
  expect(await renameOffice({ name: 'Bad' })).toEqual({ ok: false, status: 400, detail: 'Tente novamente.', errors: { name: 'Inválido.' } });
  expect(revalidatePath).not.toHaveBeenCalled();
});
test('revoked sessions remain navigation signals', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(renameOffice({ name: 'Office' })).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
});
test('transport errors are safe and configuration errors remain exceptions', async () => {
  fetchMock.mockRejectedValue(new TypeError('private detail'));
  expect(await renameOffice({ name: 'Office' })).toMatchObject({ ok: false, status: 503 });
  vi.stubEnv('NEXT_PUBLIC_API_URL', '');
  await expect(renameOffice({ name: 'Office' })).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
});
