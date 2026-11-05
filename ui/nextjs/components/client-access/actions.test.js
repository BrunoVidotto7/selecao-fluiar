// @vitest-environment node
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { inviteClient, revokeClientInvitation } from './actions';
import { getClientAccess } from './queries.server';
import { CLIENT, CLIENT_ACCESS, INVITATION } from '@/test-support/fixtures';
const { fetchMock, revalidatePath, notFound } = vi.hoisted(() => ({
  fetchMock: vi.fn(), revalidatePath: vi.fn(), notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'jwt' }) }) }));
vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('invite uses only the stored client and returns the saved invitation', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(INVITATION), { status: 201 }));
  expect(await inviteClient(CLIENT.id)).toEqual({ ok: true, data: INVITATION });
  expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:8080/api/clients/${CLIENT.id}/invitations`);
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer jwt');
});
test('revoke targets both the client and invitation', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  expect(await revokeClientInvitation(CLIENT.id, INVITATION.id)).toEqual({ ok: true, data: undefined });
  expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:8080/api/clients/${CLIENT.id}/invitations/${INVITATION.id}`);
  expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
});
test('invalid client or invitation IDs never make a request', async () => {
  expect(await inviteClient('invalid')).toMatchObject({ ok: false, status: 400 });
  expect(await revokeClientInvitation(CLIENT.id, 'invalid')).toMatchObject({ ok: false, status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});
test('failed email delivery preserves feedback without success invalidation', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Falha no envio.' }), { status: 500 }));
  expect(await inviteClient(CLIENT.id)).toMatchObject({ ok: false, status: 500, detail: 'Falha no envio.' });
  expect(revalidatePath).not.toHaveBeenCalled();
});
test('access reads return API state and reject malformed state', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(CLIENT_ACCESS)));
  expect(await getClientAccess(CLIENT.id)).toEqual(CLIENT_ACCESS);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...CLIENT_ACCESS, status: 'UNKNOWN' })));
  await expect(getClientAccess(CLIENT.id)).rejects.toMatchObject({ status: 502 });
});
