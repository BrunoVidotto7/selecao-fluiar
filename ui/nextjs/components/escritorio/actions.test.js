// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { inviteMember, renameOffice, revokeInvitation } from './actions';
import { INVITATION, ME, OFFICE } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, revalidatePath } = vi.hoisted(() => ({
  cookies: vi.fn(),
  fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  revalidatePath: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const API_ORIGIN = 'http://localhost:8080';
const INVALID_INPUT = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const RENAMED_OFFICE = { ...OFFICE, name: 'Ateliê Ana' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'private-jwt' }) });
  fetchMock.mockReset().mockResolvedValue(json(RENAMED_OFFICE));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('rename returns the persisted office and sends only its name with a private session', async () => {
  expect(await renameOffice({ name: 'Ateliê Ana', officeId: ME.officeId, members: [], token: 'injected' }))
    .toEqual({ ok: true, data: RENAMED_OFFICE });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/office', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ name: 'Ateliê Ana' }), cache: 'no-store', redirect: 'error',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
  expect(fetchMock.mock.calls[0][1].headers.get('Cookie')).toBeNull();
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/(app)', 'layout');
});

test('invite returns the API replacement invitation without exposing or sending a token or office ID', async () => {
  fetchMock.mockResolvedValue(json(INVITATION, 201));
  const result = await inviteMember({ email: 'new@example.com', officeId: ME.officeId, userId: ME.id, token: 'injected' });
  expect(result).toEqual({ ok: true, data: INVITATION });
  expect(JSON.stringify(result)).not.toContain('token');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/office/invitations', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ email: 'new@example.com' }), cache: 'no-store',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/escritorio');
});

test('revoke awaits DELETE and returns a successful 204 without invented response data', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  expect(await revokeInvitation(INVITATION.id)).toEqual({ ok: true, data: undefined });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/office/invitations/' + INVITATION.id,
    expect.objectContaining({ method: 'DELETE', body: undefined, cache: 'no-store' }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/escritorio');
});

const malformedBodies = [undefined, null, [], 'body', 123, true, {}];
test.each([
  ...malformedBodies.map((input) => ['rename', input, renameOffice]),
  ...[null, [], {}, 123, false].map((name) => ['rename', { name }, renameOffice]),
  ...malformedBodies.map((input) => ['invite', input, inviteMember]),
  ...[null, [], {}, 123, false].map((email) => ['invite', { email }, inviteMember]),
])('%s rejects malformed body %j before any authenticated write', async (_, input, action) => {
  expect(await action(input)).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  undefined, null, [], {}, 123, '', 'not-a-uuid', INVITATION.id + '/other', ' ' + INVITATION.id,
  INVITATION.id + '?officeId=' + ME.officeId, INVITATION.id + '\n',
].map((id) => [id]))('revoke rejects malformed UUID %j before any HTTP write', async (id) => {
  expect(await revokeInvitation(id)).toEqual(INVALID_INPUT);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  ['rename', renameOffice, { name: 'Ateliê Ana' }],
  ['invite', inviteMember, { email: 'new@example.com' }],
  ['revoke', revokeInvitation, INVITATION.id],
])('%s redirects a missing session without a write or success result', async (_, action, input) => {
  cookies.mockResolvedValue({ get: () => undefined });
  await expect(action(input)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  ['rename validation', renameOffice, { name: 'Ateliê Ana' }, 400, 'Revise os campos destacados.', { name: 'Preencha este campo.' }],
  ['duplicate account', inviteMember, { email: 'new@example.com' }, 409, 'Este e-mail já tem uma conta.', { email: 'Este e-mail já tem uma conta.' }],
  ['invitation rate limit', inviteMember, { email: 'new@example.com' }, 429, 'Muitas tentativas. Tente novamente em alguns minutos.', {}],
  ['email send failure', inviteMember, { email: 'new@example.com' }, 503, 'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.', {}],
  ['another office invitation', revokeInvitation, INVITATION.id, 404, 'Não encontramos o que você procurava.', {}],
  ['revoke unavailable', revokeInvitation, INVITATION.id, 503, 'Tente novamente.', {}],
])('%s preserves exact upstream feedback and does not invalidate as if successful', async (_, action, input, status, detail, errors) => {
  fetchMock.mockResolvedValue(json({ type: 'about:blank', status, detail, errors }, status));
  expect(await action(input)).toEqual({ ok: false, status, detail, errors });
  expect(revalidatePath).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test('a revoked session remains a login navigation signal rather than an ActionResult failure', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(renameOffice({ name: 'Ateliê Ana' })).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('a transport failure preserves safe API feedback and never invalidates', async () => {
  fetchMock.mockRejectedValue(new TypeError('private network failure'));
  expect(await inviteMember({ email: 'new@example.com' })).toEqual({
    ok: false, status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.', errors: {},
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('unexpected configuration errors are rethrown rather than disguised as success or API errors', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'invalid');
  await expect(renameOffice({ name: 'Ateliê Ana' })).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  ['rename', renameOffice, { name: 'Ateliê Ana' }, RENAMED_OFFICE, 200, ['/(app)', 'layout']],
  ['invite', inviteMember, { email: 'new@example.com' }, INVITATION, 201, ['/escritorio']],
  ['revoke', revokeInvitation, INVITATION.id, undefined, 204, ['/escritorio']],
])('%s does not settle or invalidate while the API write is pending', async (_, action, input, data, status, cacheArgs) => {
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let settled = false;
  const pending = action(input).then((result) => { settled = true; return result; });
  await new Promise(setImmediate);
  expect(settled).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
  release(status === 204 ? new Response(null, { status }) : json(data, status));
  expect(await pending).toEqual({ ok: true, data });
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith(...cacheArgs);
});
