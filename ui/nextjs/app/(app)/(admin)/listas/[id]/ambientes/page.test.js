import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';
import { LIST } from '@/test-support/fixtures';

const { fetchMock, cookies } = vi.hoisted(() => ({ fetchMock: vi.fn(), cookies: vi.fn() }));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/listas',
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'jwt' }) });
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify(LIST)));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('the room page awaits route params and renders rooms from the persisted list', async () => {
  render(await Page({ params: Promise.resolve({ id: LIST.id }) }));
  expect(screen.queryByRole('heading', { name: 'Gerenciar ambientes' })).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Cozinha' })).toBeTruthy();
  expect(screen.queryByText('Adicione, renomeie e organize os ambientes desta lista.')).not.toBeNull();
  expect(screen.getByRole('link', { name: 'Voltar à lista' }).getAttribute('href')).toBe(`/listas/${LIST.id}`);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`http://localhost:8080/api/lists/${LIST.id}`,
    expect.objectContaining({ method: 'GET', cache: 'no-store' }));
});

test('malformed list routes return not found before requesting private data', async () => {
  await expect(Page({ params: Promise.resolve({ id: LIST.id + '/other' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([[404, 'NEXT_NOT_FOUND'], [401, 'NEXT_REDIRECT']])(
  'room page preserves HTTP %s navigation without rendering rooms', async (status, signal) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status, detail: 'Não encontramos o que você procurava.', errors: {} }), { status }));
    await expect(Page({ params: Promise.resolve({ id: LIST.id }) })).rejects.toThrow(signal);
  },
);
