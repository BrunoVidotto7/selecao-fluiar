// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { requireAdmin, requireClient } from './auth.server';
import { getCurrentUser } from './api.server';
import { ME, CLIENT_ME } from '@/test-support/fixtures';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }) }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('./api.server', () => ({ getCurrentUser: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

test('a client cannot enter an administrative page', async () => {
  getCurrentUser.mockResolvedValue(CLIENT_ME);
  await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/my-lists');
});

test('an admin uses administrative pages rather than client APIs', async () => {
  getCurrentUser.mockResolvedValue(ME);
  await expect(requireClient()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/dashboard');
  expect(await requireAdmin()).toEqual(ME);
});
