// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { saveClient, deleteClient } from './actions';
import { CLIENT, ME } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, revalidatePath } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const ORIGIN = 'http://localhost:8080';
const BODY = { name: 'Ana Lima', email: ME.email, phone: '31999998888' };
const { lists, ...RESPONSE } = CLIENT;
const INVALID = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'private-jwt' }) });
  fetchMock.mockReset().mockResolvedValue(json(RESPONSE));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', ORIGIN);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test.each([[null, 'POST', '/api/clients', 201], [CLIENT.id, 'PUT', '/api/clients/' + CLIENT.id, 200]])(
  'save %j returns the persisted UUID and forwards only the client request fields', async (id, method, path, status) => {
    fetchMock.mockResolvedValue(json(RESPONSE, status));
    expect(await saveClient(id, { ...BODY, nome: 'ignored', officeId: ME.officeId, userId: ME.id, token: 'injected', lists: [] }))
      .toEqual({ ok: true, data: RESPONSE });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(ORIGIN + path, expect.objectContaining({
      method, body: JSON.stringify(BODY), cache: 'no-store',
    }));
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
    expect(revalidatePath.mock.calls).toEqual([
      ['/dashboard'], ['/clientes'], ['/clientes/[id]', 'layout'], ['/listas'], ['/listas/[id]', 'layout'],
    ]);
  },
);

test.each([undefined, null, [], 'body', 5, {}, { ...BODY, name: null }, { ...BODY, email: [] },
  { ...BODY, phone: null }, { ...BODY, phone: 31999998888 }, { name: 'Ana', email: ME.email }].map((body) => [body]))(
  'save rejects malformed or missing required scalar input %j before any request', async (body) => {
    expect(await saveClient(null, body)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test.each([undefined, [], {}, 12, '', 'slug', CLIENT.id + '/other', CLIENT.id + '?other=1', CLIENT.id + '\n'].map((id) => [id]))(
  'mutations reject invalid ID %j before a write', async (id) => {
    expect(await saveClient(id, BODY)).toEqual(INVALID);
    expect(await deleteClient(id)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test('delete rejects null instead of treating it as creation', async () => {
  expect(await deleteClient(null)).toEqual(INVALID);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('delete awaits the real write before returning success and invalidating', async () => {
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let settled = false;
  const pending = deleteClient(CLIENT.id).then((result) => { settled = true; return result; });
  await new Promise(setImmediate);
  expect(settled).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
  release(new Response(null, { status: 204 }));
  expect(await pending).toEqual({ ok: true, data: undefined });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(ORIGIN + '/api/clients/' + CLIENT.id,
    expect.objectContaining({ method: 'DELETE', body: undefined }));
  expect(revalidatePath).toHaveBeenCalledWith('/clientes/[id]', 'layout');
});

test('save awaits persistence before exposing the saved client or invalidating', async () => {
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let settled = false;
  const pending = saveClient(null, BODY).then((result) => { settled = true; return result; });
  await new Promise(setImmediate);
  expect(settled).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
  release(json(RESPONSE, 201));
  expect(await pending).toEqual({ ok: true, data: RESPONSE });
  expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
});

test.each([
  ['foreign edit', () => saveClient(CLIENT.id, BODY), 404, 'Não encontramos o que você procurava.', {}],
  ['foreign delete', () => deleteClient(CLIENT.id), 404, 'Não encontramos o que você procurava.', {}],
  ['invalid fields', () => saveClient(null, BODY), 400, 'Revise os campos destacados.', { phone: 'Digite o telefone com DDD, como (31) 99999-9999.' }],
  ['delete outage', () => deleteClient(CLIENT.id), 503, 'Tente novamente.', {}],
])('%s preserves API errors without success invalidation', async (_, action, status, detail, errors) => {
  fetchMock.mockResolvedValue(json({ detail, errors }, status));
  expect(await action()).toEqual({ ok: false, status, detail, errors });
  expect(revalidatePath).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test.each([
  ['missing', () => cookies.mockResolvedValue({ get: () => undefined })],
  ['revoked', () => fetchMock.mockResolvedValue(new Response(null, { status: 401 }))],
])('%s sessions preserve login navigation for both writes', async (_, setup) => {
  setup();
  await expect(saveClient(CLIENT.id, BODY)).rejects.toThrow('NEXT_REDIRECT');
  await expect(deleteClient(CLIENT.id)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(revalidatePath).not.toHaveBeenCalled();
  if (_ === 'missing') expect(fetchMock).not.toHaveBeenCalled();
});

test('unexpected programming errors are not turned into ActionResult failures', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'invalid');
  await expect(saveClient(null, BODY)).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
  expect(revalidatePath).not.toHaveBeenCalled();
});
