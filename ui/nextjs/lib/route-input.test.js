import { beforeEach, expect, test, vi } from 'vitest';
import { isLinkToken, isUuid, requireUuid } from './route-input';
import { CLIENT } from '@/test-support/fixtures';

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/navigation', () => ({ notFound }));
beforeEach(() => { notFound.mockClear(); });

test.each([CLIENT.id, 'ABCDEFAB-1234-1234-1234-ABCDEFABCDEF', '00000000-0000-0000-0000-000000000000'])(
  'a complete canonical UUID is accepted: %s', (value) => {
    expect(isUuid(value)).toBe(true);
    expect(requireUuid(value)).toBe(value);
    expect(notFound).not.toHaveBeenCalled();
  },
);

test.each([
  '', null, undefined, 123, {}, [CLIENT.id],
  CLIENT.id.slice(0, -1), CLIENT.id + '0', 'x' + CLIENT.id, CLIENT.id + '/products',
  CLIENT.id + '\n', ` ${CLIENT.id}`, CLIENT.id.replaceAll('-', ''), CLIENT.id.replace('1', 'g'),
])('an invalid UUID is rejected before route interpolation: %j', (value) => {
  expect(isUuid(value)).toBe(false);
  expect(() => requireUuid(value)).toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledOnce();
});

test.each(['a'.repeat(43), 'A_9-' + 'z'.repeat(39)])('a URL-safe 43-character link token is accepted: %s', (value) => {
  expect(isLinkToken(value)).toBe(true);
});

test.each(['a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '/', 'a'.repeat(43) + '\n', '', null, undefined, 123, ['a'.repeat(43)]])(
  'an invalid link token is rejected: %j', (value) => {
    expect(isLinkToken(value)).toBe(false);
  },
);
