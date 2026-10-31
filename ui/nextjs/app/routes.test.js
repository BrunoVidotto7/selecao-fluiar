import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { redirect } from 'next/navigation';
import Home from './page';
import NotFound from './not-found';
import ClientPage from './(app)/clientes/[id]/page';
import ListPage from './(app)/listas/[id]/page';
import EditProductPage from './(app)/listas/[id]/produtos/[produtoId]/editar/page';
import PrivateLayout from './(app)/layout';
import RootLayout from './layout';
import LoginPage from './(auth)/login/page';
import SignupPage from './(auth)/cadastro/page';
import RootError from './error';
import { ME } from '@/test-support/fixtures';

const { cookieStore, fetchMock, refresh } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }, fetchMock: vi.fn(), refresh: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => '/login',
}));
vi.mock('@/components/auth/actions', () => ({ login: vi.fn(), signup: vi.fn(), logout: vi.fn() }));

const props = (params) => ({ params: Promise.resolve(params), searchParams: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockReset();
  cookieStore.get.mockReturnValue({ value: 'jwt' });
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify(ME)));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('the root page redirects to the login screen', () => {
  expect(() => Home()).toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/login');
});

test('the not-found page explains the problem and links to the dashboard', () => {
  render(<NotFound />);
  expect(screen.getByText('Página não encontrada')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ir para o Dashboard' }).getAttribute('href')).toBe('/dashboard');
});

test.each([
  ['client', ClientPage, { id: 'inexistente' }],
  ['list', ListPage, { id: 'inexistente' }],
  ['product', EditProductPage, { id: 'lista-da-casa', produtoId: 'inexistente' }],
])('an unknown %s id shows the not-found page', async (_, Page, params) => {
  await expect(Page(props(params))).rejects.toThrow('NEXT_NOT_FOUND');
});

test('the private layout loads the current user with the cookie and passes the real identity to its shell', async () => {
  render(await PrivateLayout({ children: <p>Área privada</p> }));
  expect(screen.getByText('Ana Lima')).toBeTruthy();
  expect(screen.getByText('Escritório de Ana Lima')).toBeTruthy();
  expect(screen.getByRole('main').textContent).toBe('Área privada');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/api/me', expect.objectContaining({
    method: 'GET', cache: 'no-store',
  }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer jwt');
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('the private layout without a cookie redirects before requesting or rendering private data', async () => {
  cookieStore.get.mockReturnValue(undefined);
  await expect(Promise.resolve().then(() => PrivateLayout({ children: <p>Área privada</p> }))).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the private layout with a revoked cookie redirects instead of exposing a stale user', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(Promise.resolve().then(() => PrivateLayout({ children: <p>Área privada</p> }))).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookieStore.set).not.toHaveBeenCalled();
});

test('unexpected private layout read errors propagate to the root boundary', async () => {
  fetchMock.mockResolvedValue(new Response('<html>private proxy details</html>', { status: 502 }));
  await expect(Promise.resolve().then(() => PrivateLayout({ children: <p>Área privada</p> }))).rejects.toMatchObject({
    status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.',
  });
  expect(redirect).not.toHaveBeenCalled();
});

test('retry requests a fresh private layout render that can display the recovered API identity', async () => {
  const layoutProps = { children: <p>Área privada</p> };
  fetchMock.mockResolvedValueOnce(new Response('<html>private proxy details</html>', { status: 502 }));
  const failure = await PrivateLayout(layoutProps).catch((error) => error);
  expect(failure).toMatchObject({ status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.' });

  const reset = vi.fn();
  const view = render(<RootError error={failure} reset={reset} />);
  expect(screen.getByText('Não conseguimos carregar esta página.')).toBeTruthy();
  expect(screen.queryByText(/private proxy/)).toBeNull();
  expect(screen.queryByText('Ana Lima')).toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();

  // The router seam requests a new server render; jsdom does not run Next's Flight transport.
  let freshRender;
  refresh.mockImplementationOnce(() => { freshRender = PrivateLayout(layoutProps); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'http://localhost:8080/api/me', 'http://localhost:8080/api/me',
  ]);
  expect(reset).toHaveBeenCalledOnce();
  expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]);
  view.rerender(await freshRender);
  expect(screen.getByText('Ana Lima')).toBeTruthy();
  expect(screen.getByText('Escritório de Ana Lima')).toBeTruthy();
  expect(screen.getByRole('main').textContent).toBe('Área privada');
  expect(screen.queryByText('Não conseguimos carregar esta página.')).toBeNull();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test.each([['login', LoginPage, 'Entrar'], ['signup', SignupPage, 'Criar conta']])(
  'the %s page remains public with a revoked cookie and ignores demo states', async (_, Page, submitLabel) => {
    cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
    render(await Page({ searchParams: Promise.resolve({ estado: 'erro' }) }));
    expect(screen.getByRole('button', { name: submitLabel })).toBeTruthy();
    expect(screen.queryByText(/E-mail ou senha incorretos/)).toBeNull();
    expect(cookieStore.get).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  },
);

test('the root layout keeps page content and feedback without the prototype navigator', () => {
  const markup = renderToStaticMarkup(<RootLayout><p>Conteúdo da página</p></RootLayout>);
  const document = new DOMParser().parseFromString(markup, 'text/html');
  expect(document.documentElement.lang).toBe('pt-BR');
  expect(document.body.textContent).toContain('Conteúdo da página');
  expect(document.querySelector('[role="status"]')).not.toBeNull();
  expect(Array.from(document.querySelectorAll('button'), (button) => button.textContent)).not.toContain('Telas');
});
