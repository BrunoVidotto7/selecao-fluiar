import { notFound } from 'next/navigation';

const UUID_LENGTH = 36;
const LINK_TOKEN_LENGTH = 43;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** @param {unknown} value @returns {boolean} */
export function isUuid(value) {
  return typeof value === 'string' && value.length === UUID_LENGTH && UUID_PATTERN.test(value);
}

/** @param {unknown} value @returns {boolean} */
export function isLinkToken(value) {
  return typeof value === 'string' && value.length === LINK_TOKEN_LENGTH && LINK_TOKEN_PATTERN.test(value);
}

/** @param {string} value @returns {string} */
export function requireUuid(value) {
  if (!isUuid(value)) notFound();
  return value;
}
