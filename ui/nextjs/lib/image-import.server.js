import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ApiError } from './api.server';

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CANDIDATES = 24;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SelecaoFluiar/1.0)';

const INVALID_LINK_DETAIL = 'Cole um link completo, começando com https://';
const PRIVATE_LINK_DETAIL = 'Esse link não pode ser usado.';
const LINK_UNREACHABLE_DETAIL = 'Não conseguimos abrir esse link. Verifique se ele está completo.';
const LINK_TIMEOUT_DETAIL = 'O link demorou para responder. Tente novamente.';
const NOT_HTML_DETAIL = 'Esse link não parece ser uma página de produto.';
const PAGE_TOO_LARGE_DETAIL = 'Essa página é grande demais para buscar imagens.';
const INVALID_IMAGE_DETAIL = 'Escolha uma imagem JPG ou PNG.';
const IMAGE_TOO_LARGE_DETAIL = 'A imagem deve ter até 5 MB.';

const IMAGE_ATTRIBUTES = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-image', 'data-zoom-image'];
const SRCSET_ATTRIBUTES = ['srcset', 'data-srcset'];
const META_IMAGE_NAMES = new Set(['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);
const PRIVATE_IPV4_RANGES = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function ipv4Value(address) {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function isPrivateIpv4(value) {
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const prefix = ipv4Value(base);
    return (value >>> (32 - bits)) === (prefix >>> (32 - bits));
  });
}

/** @param {string} address */
export function isPrivateAddress(address) {
  if (typeof address !== 'string' || !address) return true;
  const value = address.toLowerCase();
  if (value.startsWith('::ffff:')) {
    const rest = value.slice(7);
    if (rest.includes('.')) return isPrivateAddress(rest);
    const [high, low] = rest.split(':');
    const mapped = ((parseInt(high, 16) << 16) | parseInt(low, 16)) >>> 0;
    return Number.isNaN(mapped) || isPrivateIpv4(mapped);
  }
  if (value.includes(':')) {
    if (value === '::' || value === '::1') return true;
    const first = parseInt(value.split(':')[0], 16);
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
  }
  const parsed = ipv4Value(value);
  return parsed === null ? true : isPrivateIpv4(parsed);
}

async function checkedUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_LINK_DETAIL);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || /[\s\\]/.test(url.href)) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_LINK_DETAIL);
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || (isIP(host) && isPrivateAddress(host))) {
    throw new ApiError(HTTP_BAD_REQUEST, PRIVATE_LINK_DETAIL);
  }

  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ApiError(HTTP_BAD_GATEWAY, LINK_UNREACHABLE_DETAIL);
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ApiError(HTTP_BAD_REQUEST, PRIVATE_LINK_DETAIL);
  }
  return url;
}

async function request(rawUrl, headers) {
  let url = await checkedUrl(rawUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response;
    try {
      response = await fetch(url.href, {
        headers: { 'User-Agent': USER_AGENT, ...headers },
        redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new ApiError(HTTP_BAD_GATEWAY, timedOut ? LINK_TIMEOUT_DETAIL : LINK_UNREACHABLE_DETAIL);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new ApiError(HTTP_BAD_GATEWAY, LINK_UNREACHABLE_DETAIL);
      url = await checkedUrl(new URL(location, url).href);
      continue;
    }
    return response;
  }
  throw new ApiError(HTTP_BAD_GATEWAY, LINK_UNREACHABLE_DETAIL);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function absoluteUrl(value, base) {
  const candidate = value?.trim();
  if (!candidate || /^(?:data|blob|javascript|mailto|tel|about):/i.test(candidate)) return null;
  try {
    const url = new URL(candidate, base);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} html
 * @param {URL | string} pageUrl
 * @returns {string[]}
 */
export function extractImageCandidates(html, pageUrl) {
  if (typeof html !== 'string') return [];
  let base;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const baseTag = html.match(/<base\b[^>]*>/i);
  const baseHref = baseTag && absoluteUrl(attribute(baseTag[0], 'href'), base);
  if (baseHref) base = new URL(baseHref);

  const candidates = [];
  const add = (value) => {
    const url = absoluteUrl(value, base);
    if (url && !candidates.includes(url) && candidates.length < MAX_CANDIDATES) candidates.push(url);
  };

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const name = attribute(tag, 'property') || attribute(tag, 'name');
    if (META_IMAGE_NAMES.has(name.toLowerCase())) add(attribute(tag, 'content'));
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = attribute(tag, 'rel').toLowerCase().split(/\s+/);
    if (rel.includes('image_src')) add(attribute(tag, 'href'));
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    for (const name of IMAGE_ATTRIBUTES) add(attribute(tag, name));
    for (const name of SRCSET_ATTRIBUTES) {
      const srcset = attribute(tag, name);
      if (srcset) add(srcset.split(',').pop().trim().split(/\s+/)[0]);
    }
  }
  return candidates;
}

/**
 * @param {string} rawUrl
 * @returns {Promise<string[]>}
 */
export async function fetchPageImages(rawUrl) {
  const response = await request(rawUrl, {
    Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5',
  });
  if (!response.ok) throw new ApiError(HTTP_BAD_GATEWAY, LINK_UNREACHABLE_DETAIL);
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type.startsWith('image/')) return [response.url || rawUrl];
  if (type !== 'text/html' && type !== 'application/xhtml+xml') {
    throw new ApiError(HTTP_BAD_REQUEST, NOT_HTML_DETAIL);
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_PAGE_BYTES) {
    throw new ApiError(HTTP_BAD_REQUEST, PAGE_TOO_LARGE_DETAIL);
  }
  const body = await response.text();
  if (body.length > MAX_PAGE_BYTES) throw new ApiError(HTTP_BAD_REQUEST, PAGE_TOO_LARGE_DETAIL);
  return extractImageCandidates(body, response.url || rawUrl);
}

function detectImageType(bytes) {
  const startsWith = (signature) => signature.every((byte, index) => bytes[index] === byte);
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

/**
 * @param {string} rawUrl
 * @returns {Promise<File>}
 */
export async function downloadProductImage(rawUrl) {
  const response = await request(rawUrl, { Accept: 'image/jpeg,image/png;q=0.9,*/*;q=0.1' });
  if (!response.ok) throw new ApiError(HTTP_BAD_GATEWAY, LINK_UNREACHABLE_DETAIL);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    throw new ApiError(HTTP_BAD_REQUEST, IMAGE_TOO_LARGE_DETAIL);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new ApiError(HTTP_BAD_REQUEST, IMAGE_TOO_LARGE_DETAIL);
  const type = detectImageType(bytes);
  if (!type) throw new ApiError(HTTP_BAD_REQUEST, INVALID_IMAGE_DETAIL);
  return new File([bytes], type === 'image/png' ? 'imagem.png' : 'imagem.jpg', { type });
}
