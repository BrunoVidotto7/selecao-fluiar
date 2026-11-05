import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { formatLongDate, formatShortDate, formatUpdatedAt, imageSource, parseBRL } from './format';
import { PRODUCT } from '@/test-support/fixtures';

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080'));
afterEach(() => vi.unstubAllEnvs());

test('short dates use the Sao Paulo calendar rather than the UTC day', () => {
  expect(formatShortDate('2026-10-28T01:20:00Z')).toBe('27 out 2026');
});

test('long dates use the Sao Paulo calendar rather than the UTC day', () => {
  expect(formatLongDate('2026-10-28T01:20:00Z')).toBe('27 de outubro de 2026');
});

test('updated dates show today, yesterday and older Sao Paulo dates', () => {
  const now = new Date('2026-10-31T18:00:00Z');
  expect(formatUpdatedAt('2026-10-31T17:20:00Z', now)).toBe('Hoje, 14:20');
  expect(formatUpdatedAt('2026-10-30T17:20:00Z', now)).toBe('Ontem');
  expect(formatUpdatedAt('2026-10-27T17:20:00Z', now)).toBe('27 out');
});

test('relative dates handle midnight and year boundaries in Sao Paulo', () => {
  const now = new Date('2027-01-01T03:15:00Z');
  expect(formatUpdatedAt('2027-01-01T03:00:00Z', now)).toBe('Hoje, 00:00');
  expect(formatUpdatedAt('2027-01-01T02:59:00Z', now)).toBe('Ontem');
  expect(formatUpdatedAt('2026-12-30T18:00:00Z', now)).toBe('30 dez');
});

test('updated dates use the default current time when now is omitted', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-31T18:00:00Z'));
  try {
    expect(formatUpdatedAt('2026-10-31T17:20:00Z')).toBe('Hoje, 14:20');
  } finally {
    vi.useRealTimers();
  }
});

test('image paths resolve only through the authenticated local proxy', () => {
  expect(imageSource(null)).toBeNull();
  expect(imageSource('/api/images/' + PRODUCT.id)).toBe('/images/' + PRODUCT.id);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com/');
  expect(imageSource('/api/images/' + PRODUCT.id)).toBe('/images/' + PRODUCT.id);
});

test('parseBRL preserves legacy grouped, blank and zero conversion', () => {
  expect(parseBRL('1.234,56')).toBe(1234.56);
  expect(parseBRL('12,50')).toBe(12.5);
  expect(parseBRL('0,00')).toBe(0);
  expect(parseBRL('')).toBe(0);
  expect(parseBRL(null)).toBe(0);
});
