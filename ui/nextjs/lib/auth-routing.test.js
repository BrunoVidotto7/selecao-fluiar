import { expect, test } from 'vitest';
import { getHomePath, getLoginPath, safeReturnPath } from './auth-routing';

test('role determines the account home', () => {
  expect(getHomePath({ role: 'CLIENT' })).toBe('/my-lists');
  expect(getHomePath({ role: 'ADMIN' })).toBe('/dashboard');
  expect(() => getHomePath({ role: 'UNKNOWN' })).toThrow();
});

test('only a complete local share path can be preserved through login', () => {
  const target = '/l/' + 'a'.repeat(43);
  expect(safeReturnPath(target)).toBe(target);
  expect(getLoginPath(target)).toBe('/login?next=' + encodeURIComponent(target));
});

test.each([undefined, null, [], 'https://evil.example', '//evil.example', '/\\evil.example',
  '/l/' + 'a'.repeat(42), '/l/' + 'a'.repeat(43) + '?next=https://evil.example',
  '/l/' + 'a'.repeat(43) + '#fragment', '/%2f%2fevil.example'].map((value) => [value]))('unsafe return target %j is discarded', (target) => {
  expect(safeReturnPath(target)).toBeNull();
  expect(getLoginPath(target)).toBe('/login');
});
