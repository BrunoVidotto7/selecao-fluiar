import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';
import { acceptInvitation } from '@/components/convite/actions';

const { cookieStore, cookies, fetchMock, redirect, notFound } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  cookies: vi.fn(), fetchMock: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({
  redirect, notFound, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/convite',
}));
vi.mock('@/components/convite/actions', () => ({ acceptInvitation: vi.fn() }));

const TOKEN = 'a'.repeat(43);
const INFO = { email: 'nova@example.com', officeName: 'Ateliê Horizonte', invitedByName: 'Ana Lima' };
const INVALID_LINK = 'Este link expirou ou já foi usado. Peça um novo.';
const API_ORIGIN = 'http://localhost:8080';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const page = (query) => Page({ searchParams: Promise.resolve(query) });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue(cookieStore);
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  fetchMock.mockReset().mockImplementation(async () => json(INFO));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test.each([
  {}, { token: [] }, { token: [TOKEN] }, { token: [TOKEN, TOKEN] },
  { token: null }, { token: {} }, { token: 123 }, { token: '' },
  { token: 'a'.repeat(42) }, { token: '/'.repeat(43) }, { token: TOKEN + '\n' },
])('missing or malformed query %j shows the invalid state without inspection or a form', async (query) => {
  const { container } = render(await page(query));
  expect(container.textContent).toContain(INVALID_LINK);
  expect(container.textContent).toContain('Peça um novo convite ao escritório.');
  expect(screen.queryByRole('button', { name: 'Criar conta e aceitar convite' })).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByRole('link', { name: 'Voltar para o login' }).getAttribute('href')).toBe('/login');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test('a valid token is inspected publicly and renders API-owned identity without changing the session on GET', async () => {
  const { container } = render(await page({ token: TOKEN, email: 'ignored@example.com', officeId: 'ignored' }));
  expect(screen.queryByRole('button', { name: 'Criar conta e aceitar convite' })).not.toBeNull();
  expect(container.textContent).toContain('nova@example.com');
  expect(container.textContent).toContain('Ateliê Horizonte');
  expect(container.textContent).toContain('Ana Lima');
  expect(container.textContent).not.toContain('ignored@example.com');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + `/api/auth/invitations/${TOKEN}`, expect.objectContaining({
    method: 'GET', cache: 'no-store',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(fetchMock.mock.calls[0][1].headers.get('Cookie')).toBeNull();
  expect(cookies).not.toHaveBeenCalled();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
  expect(acceptInvitation).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test('URL-safe token characters are accepted as one exact token', async () => {
  const token = '-_Ab'.repeat(10) + 'XYZ';
  render(await page({ token }));
  expect(screen.queryByRole('button', { name: 'Criar conta e aceitar convite' })).not.toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe(API_ORIGIN + `/api/auth/invitations/${token}`);
});

test('an expired used or revoked token shows the invalid-link state without a signup form', async () => {
  fetchMock.mockResolvedValue(json({ status: 400, detail: INVALID_LINK, errors: {} }, 400));
  const { container } = render(await page({ token: TOKEN }));
  expect(container.textContent).toContain(INVALID_LINK);
  expect(container.textContent).toContain('Peça um novo convite ao escritório.');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Criar conta e aceitar convite' })).toBeNull();
  expect(cookies).not.toHaveBeenCalled();
});

test.each(['network', 'HTTP 503', 'non-JSON proxy'])('%s inspection failure reaches the auth boundary, not the invalid-link state', async (kind) => {
  if (kind === 'network') fetchMock.mockRejectedValue(new TypeError('private network details'));
  else if (kind === 'HTTP 503') fetchMock.mockResolvedValue(json({ detail: 'Não conseguimos conectar à API. Tente novamente.', errors: {} }, 503));
  else fetchMock.mockResolvedValue(new Response('<html>private proxy details</html>', { status: 502 }));
  await expect(page({ token: TOKEN })).rejects.toMatchObject({
    status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.',
  });
  expect(cookies).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test('an unrelated API bad request is not disguised as an expired invitation', async () => {
  fetchMock.mockResolvedValue(json({ detail: 'Revise os dados enviados.', errors: {} }, 400));
  await expect(page({ token: TOKEN })).rejects.toMatchObject({ status: 400, detail: 'Revise os dados enviados.' });
  expect(cookies).not.toHaveBeenCalled();
});

test.each([null, {}, { ...INFO, email: null }, { ...INFO, officeName: [] }, { ...INFO, invitedByName: '' }].map((info) => [info]))(
  'malformed invitation info %j cannot produce an account form with invented context', async (info) => {
    fetchMock.mockResolvedValue(json(info));
    await expect(page({ token: TOKEN })).rejects.toMatchObject({ status: 502, detail: 'A API retornou uma resposta inválida.' });
    expect(cookies).not.toHaveBeenCalled();
  },
);
