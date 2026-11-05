// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { saveProduct, saveProductClientNotes, patchProduct, deleteProduct, uploadProductImage, deleteProductImage } from './actions';
import { LIST, ROOM, PRODUCT, ME, SECOND_PRODUCT, SECOND_ROOM } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect, revalidatePath } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/cache', () => ({ revalidatePath }));

const ORIGIN = 'http://localhost:8080';
const INVALID = { ok: false, status: 400, detail: 'Revise os dados enviados.', errors: {} };
const NOT_FOUND = { ok: false, status: 404, detail: 'Não encontramos o que você procurava.', errors: {} };
const BODY = { name: 'Batedeira', roomId: ROOM.id, quantity: 2, unitPrice: 0, notes: null, bought: false,
  links: [{ url: 'https://loja.com', note: null }] };
const MAX_BYTES = 5 * 1024 * 1024;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const imageData = (file = new File(['png'], 'foto.png', { type: 'image/png' })) => {
  const data = new FormData();
  data.append('file', file);
  return data;
};
const commands = [
  ['patch', (list, product) => patchProduct(list, product, { bought: true }), 'PATCH', `/api/products/${PRODUCT.id}`, PRODUCT],
  ['update', (list, product) => saveProduct(list, product, BODY), 'PUT', `/api/products/${PRODUCT.id}`, PRODUCT],
  ['delete', deleteProduct, 'DELETE', `/api/products/${PRODUCT.id}`, undefined],
  ['upload', (list, product) => uploadProductImage(list, product, imageData()), 'PUT',
    `/api/products/${PRODUCT.id}/image`, { imageUrl: '/api/images/' + PRODUCT.id }],
  ['remove image', deleteProductImage, 'DELETE', `/api/products/${PRODUCT.id}/image`, undefined],
];

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'private-jwt' }) });
  fetchMock.mockReset().mockImplementation(async (_, options) => options.method === 'GET'
    ? json(LIST) : options.method === 'DELETE' ? new Response(null, { status: 204 }) : json(PRODUCT));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', ORIGIN);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('create sends only ProductRequest fields and returns the saved API UUID', async () => {
  const input = { ...BODY, officeId: ME.officeId, imageUrl: 'injected', token: 'injected',
    links: [{ ...BODY.links[0], id: 'row5', bought: true }] };
  expect(await saveProduct(LIST.id, null, input)).toEqual({ ok: true, data: PRODUCT });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${ORIGIN}/api/lists/${LIST.id}/products`,
    expect.objectContaining({ method: 'POST' }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(BODY);
  expect(revalidatePath).toHaveBeenCalledWith('/listas/[id]', 'layout');
});

test.each(commands)('%s checks list membership before the fixed product write', async (_, command, method, path, data) => {
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST)
    : data === undefined ? new Response(null, { status: 204 }) : json(data));
  expect(await command(LIST.id, PRODUCT.id)).toEqual({ ok: true, data });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${ORIGIN}/api/lists/${LIST.id}`, ORIGIN + path]);
  expect(fetchMock.mock.calls[1][1].method).toBe(method);
  expect(fetchMock.mock.calls[1][1].headers.has('Authorization')).toBe(true);
  expect(revalidatePath).toHaveBeenCalledWith('/listas/[id]', 'layout');
});

test.each(commands)('%s rejects a product from another list without a write', async (_, command) => {
  expect(await command(LIST.id, SECOND_PRODUCT.id)).toEqual(NOT_FOUND);
  expect(fetchMock.mock.calls.map(([, options]) => options.method)).toEqual(['GET']);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each(commands)('%s preserves a cross-office list 404 as an action failure', async (_, command) => {
  fetchMock.mockResolvedValue(json({ detail: NOT_FOUND.detail }, 404));
  expect(await command(LIST.id, PRODUCT.id)).toEqual(NOT_FOUND);
  expect(fetchMock.mock.calls.map(([, options]) => options.method)).toEqual(['GET']);
});

test.each([undefined, null, [], {}, '', 'slug', LIST.id + '?other=1'].map((id) => [id]))(
  'all commands reject malformed list/product UUIDs %j before reading or writing', async (id) => {
    expect(await saveProduct(id, null, BODY)).toEqual(INVALID);
    for (const [name, command] of commands) {
      expect(await command(id, PRODUCT.id)).toEqual(INVALID);
      if (id !== null || name !== 'update') expect(await command(LIST.id, id)).toEqual(INVALID);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  },
);

test.each([
  undefined, null, [], 'body', {}, { ...BODY, roomId: 'room' }, { ...BODY, name: [] },
  { ...BODY, quantity: '2' }, { ...BODY, quantity: 1.5 }, { ...BODY, quantity: NaN },
  { ...BODY, unitPrice: '2.50' }, { ...BODY, unitPrice: Infinity }, { ...BODY, notes: [] },
  { ...BODY, bought: 'false' }, { ...BODY, links: {} }, { ...BODY, links: [null] },
  { ...BODY, links: Array(1) }, { ...BODY, links: [{ url: 1 }] }, { ...BODY, links: [{ url: 'https://loja.com', note: [] }] },
].map((body) => [body]))('malformed ProductRequest %j is rejected without a write', async (body) => {
  expect(await saveProduct(LIST.id, null, body)).toEqual(INVALID);
  expect(await saveProduct(LIST.id, PRODUCT.id, body)).toEqual(INVALID);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('optional DTO fields normalize to the API defaults', async () => {
  expect((await saveProduct(LIST.id, null, { name: 'Item', roomId: ROOM.id, quantity: 1 })).ok).toBe(true);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    name: 'Item', roomId: ROOM.id, quantity: 1, unitPrice: null, notes: null, bought: false, links: [],
  });
});

test('multipart uses exactly file, with no manually supplied Content-Type', async () => {
  const formData = imageData();
  formData.append('officeId', ME.officeId);
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST)
    : json({ imageUrl: '/api/images/' + PRODUCT.id }));
  expect(await uploadProductImage(LIST.id, PRODUCT.id, formData)).toEqual({
    ok: true, data: { imageUrl: '/api/images/' + PRODUCT.id },
  });
  const request = fetchMock.mock.calls[1][1];
  expect(request.body).toBeInstanceOf(FormData);
  expect([...request.body.keys()]).toEqual(['file']);
  expect(request.body.get('file').name).toBe('foto.png');
  expect(request.body.get('file').size).toBe(3);
  expect(request.headers.has('Content-Type')).toBe(false);
});

test.each([
  [undefined, 'Revise os dados enviados.'],
  [null, 'Revise os dados enviados.'],
  [{ file: new File(['x'], 'foto.png', { type: 'image/png' }) }, 'Revise os dados enviados.'],
  [new FormData(), 'Escolha um arquivo de imagem (JPG ou PNG).'],
  [imageData(new File([], 'foto.png', { type: 'image/png' })), 'Escolha um arquivo de imagem (JPG ou PNG).'],
  [imageData(new File(['x'], 'foto.gif', { type: 'image/gif' })), 'Escolha um arquivo de imagem (JPG ou PNG).'],
  [imageData(new File([new Uint8Array(MAX_BYTES + 1)], 'foto.png', { type: 'image/png' })), 'A imagem deve ter até 5 MB.'],
])('invalid uploads are rejected at the action boundary before any API call', async (data, detail) => {
  expect(await uploadProductImage(LIST.id, PRODUCT.id, data)).toEqual({ ok: false, status: 400, detail, errors: {} });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['image/png', 'image/jpeg'])('an exact 5MiB %s upload reaches the API for byte inspection', async (type) => {
  expect((await uploadProductImage(LIST.id, PRODUCT.id, imageData(new File([new Uint8Array(MAX_BYTES)], 'foto', { type })))).ok)
    .toBe(true);
  expect(fetchMock.mock.calls[1][1].body.get('file').size).toBe(MAX_BYTES);
});

test('duplicate multipart file fields are rejected instead of silently selecting one', async () => {
  const data = imageData();
  data.append('file', new File(['x'], 'other.png', { type: 'image/png' }));
  expect(await uploadProductImage(LIST.id, PRODUCT.id, data)).toEqual(INVALID);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(commands)('%s keeps API ProblemDetail failures and revoked-session navigation', async (_, command) => {
  const failure = { detail: 'Escolha um ambiente desta lista.', errors: { roomId: 'Escolha um ambiente desta lista.' } };
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST) : json(failure, 400));
  expect(await command(LIST.id, PRODUCT.id)).toEqual({ ok: false, status: 400, ...failure });
  expect(revalidatePath).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(command(LIST.id, PRODUCT.id)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
});

test('unexpected errors are not disguised as expected action failures', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'invalid');
  await expect(saveProduct(LIST.id, null, BODY)).rejects.toThrow('Configure NEXT_PUBLIC_API_URL');
});

test.each([
  [{ bought: true }, { bought: true }],
  [{ quantity: 3 }, { quantity: 3 }],
  [{ bought: false, quantity: 999, roomId: SECOND_ROOM.id, name: 'injected', officeId: ME.officeId },
    { bought: false, quantity: 999 }],
  [{ bought: null, quantity: null }, { bought: null, quantity: null }],
  [{}, {}],
])('PATCH whitelists ProductStatusRequest fields and returns the confirmed product', async (patch, body) => {
  const saved = { ...PRODUCT, bought: true, quantity: 3 };
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST) : json(saved));
  expect(await patchProduct(LIST.id, PRODUCT.id, patch)).toEqual({ ok: true, data: saved });
  expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
    [`${ORIGIN}/api/lists/${LIST.id}`, 'GET'], [`${ORIGIN}/api/products/${PRODUCT.id}`, 'PATCH'],
  ]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(body);
});

test.each([undefined, null, [], '', { bought: 1 }, { bought: 'false' },
  { quantity: '' }, { quantity: '2' }, { quantity: 1.5 }, { quantity: NaN }, { quantity: Infinity },
].map((patch) => [patch]))('PATCH rejects malformed status input %j before reading or writing', async (patch) => {
  expect(await patchProduct(LIST.id, PRODUCT.id, patch)).toEqual(INVALID);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test('PATCH without a session navigates to login without a read or write', async () => {
  cookies.mockResolvedValue({ get: () => undefined });
  await expect(patchProduct(LIST.id, PRODUCT.id, { quantity: 3 })).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('PATCH preserves the product write other-office 404 and quantity field validation without revalidation', async () => {
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST)
    : json({ detail: NOT_FOUND.detail }, 404));
  expect(await patchProduct(LIST.id, PRODUCT.id, { bought: true })).toEqual(NOT_FOUND);
  expect(revalidatePath).not.toHaveBeenCalled();
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST)
    : json({ detail: 'Revise os campos destacados.', errors: { quantity: 'Use um valor até 999.' } }, 400));
  expect(await patchProduct(LIST.id, PRODUCT.id, { quantity: 1000 })).toEqual({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { quantity: 'Use um valor até 999.' },
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('admin notes are persisted independently and only inside the selected list', async () => {
  const saved = { ...PRODUCT, clientNotes: 'Bought locally' };
  fetchMock.mockImplementation(async (_, options) => options.method === 'GET' ? json(LIST) : json(saved));
  expect(await saveProductClientNotes(LIST.id, PRODUCT.id, '  Bought locally  ')).toEqual({ ok: true, data: saved });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    ORIGIN + '/api/lists/' + LIST.id, ORIGIN + '/api/products/' + PRODUCT.id + '/client-notes',
  ]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ clientNotes: 'Bought locally' });
});
