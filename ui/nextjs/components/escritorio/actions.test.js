// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createCategory, deleteCategory, renameCategory, renameOffice } from './actions';
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

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
test('category actions call the right endpoint and revalidate', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: CATEGORY_ID, name: 'Pedras', productCount: 0 })));
  expect(await createCategory({ name: 'Pedras' })).toMatchObject({ ok: true });
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/office/categories');
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ name: 'Pedras' }));
  expect(await renameCategory(CATEGORY_ID, { name: 'Novas' })).toMatchObject({ ok: true });
  expect(fetchMock.mock.calls[1][0]).toBe(`http://localhost:8080/api/office/categories/${CATEGORY_ID}`);
  expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
  expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ name: 'Novas' }));
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  expect(await deleteCategory(CATEGORY_ID)).toMatchObject({ ok: true });
  expect(fetchMock.mock.calls[2][0]).toBe(`http://localhost:8080/api/office/categories/${CATEGORY_ID}`);
  expect(fetchMock.mock.calls[2][1].method).toBe('DELETE');
  expect(revalidatePath).toHaveBeenCalledWith('/escritorio');
  expect(revalidatePath).toHaveBeenCalledWith('/clientes');
});
test.each([undefined, null, [], {}, { name: 1 }].map((input) => [input]))('invalid category input %j has no side effects', async (input) => {
  expect(await createCategory(input)).toMatchObject({ ok: false, status: 400 });
  expect(await renameCategory(CATEGORY_ID, input)).toMatchObject({ ok: false, status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});
test('invalid category ids have no side effects', async () => {
  expect(await renameCategory('x', { name: 'A' })).toMatchObject({ ok: false, status: 400 });
  expect(await deleteCategory('x')).toMatchObject({ ok: false, status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});
