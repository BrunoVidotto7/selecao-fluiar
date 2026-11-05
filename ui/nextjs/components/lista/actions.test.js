import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { rotateShareToken } from './actions';
import { LIST } from '@/test-support/fixtures';

const { cookieStore, fetchMock, revalidatePath } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn() }, fetchMock: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: 'private-jwt' });
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ shareToken: 'b'.repeat(43) })));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('rotation posts once to the private UUID endpoint and returns the opaque token', async () => {
  expect(await rotateShareToken(LIST.id)).toEqual({ ok: true, data: { shareToken: 'b'.repeat(43) } });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    'http://localhost:8080/api/lists/22222222-2222-4222-8222-222222222222/share-token',
    expect.objectContaining({ method: 'POST', body: undefined, cache: 'no-store' }),
  );
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
  expect(revalidatePath.mock.calls).toEqual([
    ['/dashboard'], ['/my-lists'], ['/my-lists/[id]', 'layout'], ['/clientes'], ['/clientes/[id]', 'layout'], ['/listas'], ['/listas/[id]', 'layout'],
  ]);
});

test.each([[null], [undefined], [''], ['invalid'], [LIST.id + '/share-token'], [LIST.id + '\n'], [{}], [[]]])(
  'invalid list identifier %j returns a failure without writing', async (id) => {
    expect(await rotateShareToken(id)).toEqual({
      ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {},
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieStore.get).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test.each([404, 429, 503])('rotation failure %s preserves the API detail without cache invalidation', async (status) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não foi possível alterar o link.' }), { status }));
  expect(await rotateShareToken(LIST.id)).toEqual({
    ok: false, status, detail: 'Não foi possível alterar o link.', errors: {},
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('a rotation transport failure returns useful feedback rather than a token', async () => {
  fetchMock.mockRejectedValue(new TypeError('connection refused'));
  expect(await rotateShareToken(LIST.id)).toEqual({
    ok: false, status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.', errors: {},
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([undefined, { value: 'revoked-jwt' }])('private session %j preserves login navigation', async (session) => {
  cookieStore.get.mockReturnValue(session);
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(rotateShareToken(LIST.id)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('unexpected configuration errors are not converted into API failures', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://foreign.example/api');
  await expect(rotateShareToken(LIST.id)).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});
