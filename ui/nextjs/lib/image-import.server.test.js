// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup }));

import { downloadProductImage, extractImageCandidates, fetchPageImages, isPrivateAddress } from './image-import.server';

const PAGE = 'https://loja.com/produto/batedeira';
const PUBLIC_ADDRESS = [{ address: '93.184.216.34', family: 4 }];
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
const html = (body) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const binary = (body, type) => new Response(body, { status: 200, headers: { 'Content-Type': type } });

beforeEach(() => {
  vi.clearAllMocks();
  lookup.mockResolvedValue(PUBLIC_ADDRESS);
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); });

test('extractImageCandidates reads meta, link, img and srcset values in page order and resolves them', () => {
  const page = `
    <html><head>
      <meta property="og:image" content="/og.png">
      <meta name="twitter:image" content="https://cdn.loja.com/twitter.jpg">
      <link rel="image_src" href="//cdn.loja.com/link.jpg">
    </head><body>
      <img src="foto.jpg" alt="Foto">
      <img data-src="lazy.jpg">
      <img srcset="small.jpg 1x, big.jpg 2x">
      <img src="foto.jpg">
      <img src="data:image/png;base64,abc">
      <img src="javascript:alert(1)">
    </body></html>`;
  expect(extractImageCandidates(page, new URL(PAGE))).toEqual([
    'https://loja.com/og.png',
    'https://cdn.loja.com/twitter.jpg',
    'https://cdn.loja.com/link.jpg',
    'https://loja.com/produto/foto.jpg',
    'https://loja.com/produto/lazy.jpg',
    'https://loja.com/produto/big.jpg',
  ]);
});

test('extractImageCandidates honors a base href and decodes entity separators', () => {
  const page = '<base href="https://cdn.loja.com/produtos/"><img src="foto.png?a=1&amp;b=2">';
  expect(extractImageCandidates(page, new URL(PAGE))).toEqual(['https://cdn.loja.com/produtos/foto.png?a=1&b=2']);
});

test('extractImageCandidates caps the number of choices', () => {
  const page = Array.from({ length: 40 }, (_, index) => `<img src="foto-${index}.png">`).join('');
  expect(extractImageCandidates(page, new URL(PAGE))).toHaveLength(24);
});

test.each([
  ['127.0.0.1', true], ['10.1.2.3', true], ['172.16.0.1', true], ['172.31.255.255', true],
  ['172.32.0.1', false], ['192.168.1.10', true], ['169.254.0.1', true], ['0.0.0.0', true],
  ['100.64.0.1', true], ['8.8.8.8', false], ['::1', true], ['fc00::1', true], ['fe80::1', true],
  ['2001:4860:4860::8888', false], ['::ffff:192.168.1.1', true],
])('isPrivateAddress(%s) is %s', (address, expected) => {
  expect(isPrivateAddress(address)).toBe(expected);
});

test.each([
  'ftp://loja.com/foto.jpg', 'javascript:alert(1)', 'file:///etc/passwd',
  'https://user:pass@loja.com/foto.jpg', 'https://localhost/produto', 'not a link',
])('fetchPageImages rejects the unsafe link %j before any request', async (link) => {
  await expect(fetchPageImages(link)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

test('fetchPageImages rejects a hostname that resolves to a private address', async () => {
  lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
  await expect(fetchPageImages(PAGE)).rejects.toThrow('Esse link não pode ser usado.');
  expect(fetch).not.toHaveBeenCalled();
});

test('fetchPageImages extracts the images from an HTML product page', async () => {
  fetch.mockResolvedValue(html('<img src="/foto.png"><meta property="og:image" content="/og.jpg">'));
  expect(await fetchPageImages(PAGE)).toEqual([
    'https://loja.com/og.jpg', 'https://loja.com/foto.png',
  ]);
  expect(fetch).toHaveBeenCalledWith(PAGE, expect.objectContaining({ redirect: 'manual' }));
});

test('a direct image link is offered as the single choice', async () => {
  fetch.mockResolvedValue(binary(PNG, 'image/png'));
  expect(await fetchPageImages('https://cdn.loja.com/foto.png')).toEqual(['https://cdn.loja.com/foto.png']);
});

test('a redirect is validated before it is followed', async () => {
  fetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/secret' } }));
  await expect(fetchPageImages(PAGE)).rejects.toThrow('Esse link não pode ser usado.');
  expect(fetch).toHaveBeenCalledOnce();
});

test('follows a public redirect and extracts images from the destination page', async () => {
  fetch
    .mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: '/produto/batedeira' } }))
    .mockResolvedValueOnce(html('<img src="foto.png">'));
  expect(await fetchPageImages(PAGE)).toEqual(['https://loja.com/produto/foto.png']);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test.each([
  ['a page that is not HTML', new Response('no', { headers: { 'Content-Type': 'application/json' } })],
  ['an unavailable page', new Response('no', { status: 404, headers: { 'Content-Type': 'text/html' } })],
  ['an oversized page', new Response('x', { headers: { 'Content-Type': 'text/html', 'Content-Length': String(3 * 1024 * 1024) } })],
])('fetchPageImages reports %s', async (_, response) => {
  fetch.mockResolvedValue(response);
  await expect(fetchPageImages(PAGE)).rejects.toThrow();
});

test('downloadProductImage returns a File named by the detected image type', async () => {
  fetch.mockResolvedValue(binary(PNG, 'application/octet-stream'));
  const file = await downloadProductImage('https://cdn.loja.com/foto.png');
  expect(file).toBeInstanceOf(File);
  expect(file.type).toBe('image/png');
  expect(file.name).toBe('imagem.png');
  expect(file.size).toBe(PNG.length);
});

test.each([
  ['a JPEG', JPEG, 'image/jpeg', 'imagem.jpg'],
  ['a PNG', PNG, 'image/png', 'imagem.png'],
])('downloadProductImage detects %s from its bytes', async (_, bytes, type, name) => {
  fetch.mockResolvedValue(binary(bytes, 'image/webp'));
  const file = await downloadProductImage('https://cdn.loja.com/foto');
  expect([file.type, file.name]).toEqual([type, name]);
});

test.each([
  ['a non-image response', new Response('no', { headers: { 'Content-Type': 'text/html' } })],
  ['a WebP image', binary(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 'image/webp')],
  ['an oversized image', new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } })],
  ['an unavailable image', new Response('no', { status: 404 })],
])('downloadProductImage rejects %s', async (_, response) => {
  fetch.mockResolvedValue(response);
  await expect(downloadProductImage('https://cdn.loja.com/foto.png')).rejects.toThrow();
});
