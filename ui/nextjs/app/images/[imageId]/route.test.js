// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from './route';
const { fetchMock, cookies, cookieStore } = vi.hoisted(() => ({
  fetchMock: vi.fn(), cookies: vi.fn(), cookieStore: { get: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));
const IMAGE_ID = '55555555-5555-4555-8555-555555555555';
const load = (imageId = IMAGE_ID) => GET(new Request('http://localhost/images/' + imageId), { params: Promise.resolve({ imageId }) });
beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue(cookieStore);
  cookieStore.get.mockReturnValue({ value: 'private-jwt' });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('the image proxy requires a session before contacting the API', async () => {
  cookieStore.get.mockReturnValue(undefined);
  expect((await load()).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
test('authorized images retain bytes and type without public caching or unsafe headers', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  fetchMock.mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Set-Cookie': 'private', 'Cache-Control': 'public' } }));
  const response = await load();
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get('Content-Type')).toBe('image/png');
  expect(response.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
  expect(response.headers.get('Set-Cookie')).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/images/' + IMAGE_ID);
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer private-jwt');
  expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
});
test.each([401, 404])('an upstream %s does not become a public image', async (status) => {
  fetchMock.mockResolvedValue(new Response('private upstream information', { status }));
  const response = await load();
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain('private upstream information');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
test('invalid IDs cannot turn the proxy into an arbitrary fetch', async () => {
  const response = await load('https://evil.example/image.png');
  expect(response.status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
test('network failure and unexpected content use safe errors', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('private network detail'));
  expect((await load()).status).toBe(503);
  fetchMock.mockResolvedValueOnce(new Response('<script>private</script>', { headers: { 'Content-Type': 'text/html' } }));
  expect((await load()).status).toBe(502);
});
