// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { saveList, deleteList } from './actions';
import { CLIENT, LIST, ME } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, revalidatePath } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const ORIGIN = 'http://localhost:8080';
const BODY = { name: 'Casa nova', description: null, clientId: CLIENT.id };
const INVALID = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'private-jwt' }) });
  fetchMock.mockReset().mockResolvedValue(json(LIST));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', ORIGIN);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test.each([[null, 'POST', '/api/lists', 201], [LIST.id, 'PUT', '/api/lists/' + LIST.id, 200]])(
  'save %j returns the API UUID and forwards only allowed fields', async (id, method, path, status) => {
    fetchMock.mockResolvedValue(json(LIST, status));
    expect(await saveList(id, { ...BODY, nome: 'ignored', cli: ME.id, officeId: ME.officeId, token: 'injected', rooms: [] }))
      .toEqual({ ok: true, data: LIST });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(ORIGIN + path, expect.objectContaining({
      method, body: JSON.stringify(BODY), cache: 'no-store', redirect: 'error',
    }));
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
    expect(revalidatePath.mock.calls).toEqual([
      ['/dashboard'], ['/minhas-listas'], ['/minhas-listas/[id]', 'layout'], ['/clientes'], ['/clientes/[id]', 'layout'], ['/listas'], ['/listas/[id]', 'layout'],
    ]);
  },
);

test('delete returns no invented data after the API accepts a 204', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  expect(await deleteList(LIST.id)).toEqual({ ok: true, data: undefined });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(ORIGIN + '/api/lists/' + LIST.id,
    expect.objectContaining({ method: 'DELETE', body: undefined }));
  expect(revalidatePath).toHaveBeenCalledWith('/listas/[id]', 'layout');
});

test.each([undefined, null, [], 'body', 5, {}, { ...BODY, name: null }, { ...BODY, description: [] },
  { ...BODY, clientId: null }, { ...BODY, clientId: CLIENT.id + '/other' }].map((body) => [body]))(
  'save rejects malformed input %j before reading a session or writing', async (body) => {
    expect(await saveList(null, body)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test.each([undefined, [], {}, 12, '', 'slug', LIST.id + '?other=1', LIST.id + '\n'].map((id) => [id]))(
  'mutation rejects malformed list ID %j without a write', async (id) => {
    expect(await saveList(id, BODY)).toEqual(INVALID);
    expect(await deleteList(id)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test('delete rejects null instead of treating it as creation', async () => {
  expect(await deleteList(null)).toEqual(INVALID);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  ['foreign list edit', () => saveList(LIST.id, BODY), 404, 'Não encontramos o que você procurava.', {}],
  ['foreign list delete', () => deleteList(LIST.id), 404, 'Não encontramos o que você procurava.', {}],
  ['deleted or foreign client', () => saveList(null, BODY), 400, 'Revise os campos destacados.', { clientId: 'Escolha o cliente desta lista.' }],
  ['delete unavailable', () => deleteList(LIST.id), 503, 'Tente novamente.', {}],
])('%s preserves upstream errors without success invalidation', async (_, action, status, detail, errors) => {
  fetchMock.mockResolvedValue(json({ status, detail, errors }, status));
  expect(await action()).toEqual({ ok: false, status, detail, errors });
  expect(revalidatePath).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test.each([
  ['missing', () => cookies.mockResolvedValue({ get: () => undefined })],
  ['revoked', () => fetchMock.mockResolvedValue(new Response(null, { status: 401 }))],
])('%s sessions preserve login navigation rather than a failed action result', async (_, setup) => {
  setup();
  await expect(saveList(LIST.id, BODY)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('unexpected configuration errors are not wrapped as an API error', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'invalid');
  await expect(saveList(null, BODY)).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('save does not settle or invalidate before its HTTP write completes', async () => {
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let settled = false;
  const pending = saveList(null, BODY).then((result) => { settled = true; return result; });
  await new Promise(setImmediate);
  expect(settled).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
  release(json(LIST, 201));
  expect(await pending).toEqual({ ok: true, data: LIST });
  expect(revalidatePath).toHaveBeenCalledWith('/listas');
});
