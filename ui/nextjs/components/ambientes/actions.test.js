// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRoom, renameRoom, deleteRoom, reorderRooms } from './actions';
import { LIST, ROOM, SECOND_ROOM, ME } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, revalidatePath } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const ORIGIN = 'http://localhost:8080';
const INVALID = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const commands = [
  ['create', (id, body) => createRoom(id, body), LIST.id, { name: 'Cozinha' }, 'POST', `/api/lists/${LIST.id}/rooms`, ROOM, 201],
  ['rename', (id, body) => renameRoom(id, body), ROOM.id, { name: 'Cozinha' }, 'PUT', `/api/rooms/${ROOM.id}`, ROOM, 200],
  ['delete', (id) => deleteRoom(id), ROOM.id, undefined, 'DELETE', `/api/rooms/${ROOM.id}`, undefined, 204],
  ['reorder', (id, body) => reorderRooms(id, body), LIST.id, [SECOND_ROOM.id, ROOM.id], 'PUT',
    `/api/lists/${LIST.id}/room-order`, [SECOND_ROOM, ROOM], 200],
];

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'private-jwt' }) });
  fetchMock.mockReset().mockResolvedValue(json([ROOM, SECOND_ROOM]));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', ORIGIN);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test.each(commands)('%s sends the documented fixed request and returns persisted API data', async (
  _, command, id, input, method, path, data, status,
) => {
  fetchMock.mockResolvedValue(status === 204 ? new Response(null, { status }) : json(data, status));
  const supplied = method === 'POST' || path === `/api/rooms/${ROOM.id}` && method === 'PUT'
    ? { ...input, officeId: ME.officeId, token: 'injected', products: [] } : input;
  expect(await command(id, supplied)).toEqual({ ok: true, data });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(ORIGIN + path, expect.objectContaining({
    method, body: input === undefined ? undefined : JSON.stringify(Array.isArray(input) ? { roomIds: input } : input),
    cache: 'no-store', redirect: 'error',
  }));
  expect(fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(true);
  expect(revalidatePath.mock.calls).toEqual([
    ['/dashboard'], ['/clientes'], ['/clientes/[id]', 'layout'], ['/listas'], ['/listas/[id]', 'layout'],
  ]);
});

test.each([undefined, null, [], {}, 12, '', 'slug', LIST.id + '?other=1', LIST.id + '\n'].map((id) => [id]))(
  'all room mutations reject malformed UUID %j before any session read or write', async (id) => {
    for (const [, command, , input] of commands) expect(await command(id, input)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test.each([undefined, null, [], 'body', 5, {}, { name: null }, { name: [] }, { name: 12 }].map((body) => [body]))(
  'create and rename reject malformed name bodies %j before writing', async (body) => {
    expect(await createRoom(LIST.id, body)).toEqual(INVALID);
    expect(await renameRoom(ROOM.id, body)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

const LETTER_UUID = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
test.each([undefined, null, {}, 'body', [], [null], [12], [ROOM.id + '/other'],
  [ROOM.id, ROOM.id], [LETTER_UUID, LETTER_UUID.toUpperCase()], Array(1), [ROOM.id, , SECOND_ROOM.id]].map((body) => [body]))(
  'reorder rejects malformed, empty or duplicate room arrays %j before writing', async (body) => {
    expect(await reorderRooms(LIST.id, body)).toEqual(INVALID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test.each(commands)('%s preserves API ownership or business errors without invalidating', async (_, command, id, input) => {
  const failure = { status: 404, detail: 'Não encontramos o que você procurava.', errors: {} };
  fetchMock.mockResolvedValue(json(failure, 404));
  expect(await command(id, input)).toEqual({ ok: false, ...failure });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  [() => createRoom(LIST.id, { name: 'Cozinha' }), 409, 'Já existe um ambiente com esse nome nesta lista.', 'name'],
  [() => renameRoom(ROOM.id, { name: 'Sala' }), 409, 'Já existe um ambiente com esse nome nesta lista.', 'name'],
  [() => reorderRooms(LIST.id, [ROOM.id]), 400, 'Envie todos os ambientes da lista, sem repetir.', 'roomIds'],
])('room validation returns the upstream ProblemDetail unchanged', async (command, status, detail, field) => {
  const failure = { status, detail, errors: { [field]: detail } };
  fetchMock.mockResolvedValue(json(failure, status));
  expect(await command()).toEqual({ ok: false, ...failure });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each(commands)('%s preserves revoked-session navigation', async (_, command, id, input) => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(command(id, input)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('a missing session redirects without a write', async () => {
  cookies.mockResolvedValue({ get: () => undefined });
  await expect(createRoom(LIST.id, { name: 'Cozinha' })).rejects.toThrow('NEXT_REDIRECT');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('unexpected configuration failures are not converted to an action failure', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'invalid');
  await expect(renameRoom(ROOM.id, { name: 'Cozinha' })).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
});

test('room invalidation waits for the completed API write', async () => {
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const pending = createRoom(LIST.id, { name: 'Cozinha' });
  await new Promise(setImmediate);
  expect(revalidatePath).not.toHaveBeenCalled();
  release(json(ROOM, 201));
  expect(await pending).toEqual({ ok: true, data: ROOM });
  expect(revalidatePath).toHaveBeenCalledWith('/listas/[id]', 'layout');
});
