import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { redirect } from 'next/navigation';
import Home from './page';
import NotFound from './not-found';
import ClientPage from './(app)/clientes/[id]/page';
import { generateMetadata as clientMetadata } from './(app)/clientes/[id]/page';
import ClientsPage from './(app)/clientes/page';
import EditClientPage from './(app)/clientes/[id]/editar/page';
import ListPage from './(app)/listas/[id]/page';
import { generateMetadata as listMetadata } from './(app)/listas/[id]/page';
import ListsPage from './(app)/listas/page';
import EditProductPage from './(app)/listas/[id]/produtos/[produtoId]/editar/page';
import NewProductPage from './(app)/listas/[id]/produtos/novo/page';
import PrivateLayout from './(app)/layout';
import RootLayout from './layout';
import LoginPage from './(auth)/login/page';
import SignupPage from './(auth)/cadastro/page';
import InvitationPage from './(auth)/convite/page';
import RootError from './error';
import PrivateError from './(app)/error';
import { CLIENT, LIST, ME, OFFICE, PRODUCT, ROOM, SECOND_PRODUCT } from '@/test-support/fixtures';

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
vi.mock('@/components/convite/actions', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/components/produtos/actions', () => ({
  saveProduct: vi.fn(), deleteProduct: vi.fn(), uploadProductImage: vi.fn(), deleteProductImage: vi.fn(),
}));

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

test('a mismatched nested product URL is not found even when its UUID exists elsewhere', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(LIST)));
  await expect(EditProductPage(props({ id: LIST.id, produtoId: SECOND_PRODUCT.id }))).rejects.toThrow('NEXT_NOT_FOUND');
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['http://localhost:8080/api/lists/' + LIST.id]);
});

test('new and edit product routes read actual list rooms and client identity, never prototype data', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(LIST)));
  const view = render(await NewProductPage({ ...props({ id: LIST.id }), searchParams: Promise.resolve({ ambiente: ROOM.id }) }));
  expect(screen.getByLabelText('Ambiente').value).toBe(ROOM.id);
  expect(screen.getAllByRole('option').map((option) => option.value)).toEqual(['', ROOM.id]);
  expect(screen.getByText('Casa nova · Mariana Souza')).toBeTruthy();
  view.rerender(await EditProductPage(props({ id: LIST.id, produtoId: PRODUCT.id })));
  expect(screen.getByLabelText('Nome do produto').value).toBe(PRODUCT.name);
  expect(screen.getByLabelText('Ambiente').value).toBe(ROOM.id);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'http://localhost:8080/api/lists/' + LIST.id, 'http://localhost:8080/api/lists/' + LIST.id,
  ]);
});

test.each([NewProductPage, EditProductPage])('a product route preserves a cross-office list 404', async (Page) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não encontramos o que você procurava.' }), { status: 404 }));
  await expect(Page(props({ id: LIST.id, produtoId: PRODUCT.id }))).rejects.toThrow('NEXT_NOT_FOUND');
});

test('edit product forms reset when navigating to another product UUID', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...LIST, rooms: [{ ...ROOM, products: [
    PRODUCT, { ...SECOND_PRODUCT, roomId: ROOM.id },
  ] }] })));
  const view = render(await EditProductPage(props({ id: LIST.id, produtoId: PRODUCT.id })));
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Rascunho' } });
  view.rerender(await EditProductPage(props({ id: LIST.id, produtoId: SECOND_PRODUCT.id })));
  expect(screen.getByLabelText('Nome do produto').value).toBe('Sofá');
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

test('the invitation route stays in the public auth layout with a revoked browser session', async () => {
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  fetchMock.mockResolvedValue(new Response(JSON.stringify({
    email: 'nova@example.com', officeName: 'Ateliê Horizonte', invitedByName: 'Ana Lima',
  })));
  render(await InvitationPage({ searchParams: Promise.resolve({ token: 'a'.repeat(43) }) }));
  expect(screen.queryByRole('button', { name: 'Criar conta e aceitar convite' })).not.toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(cookieStore.get).not.toHaveBeenCalled();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

test('list metadata uses the same authoritative list read as the page', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(LIST)));
  expect(await listMetadata(props({ id: LIST.id }))).toEqual({ title: 'Casa nova' });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['http://localhost:8080/api/lists/' + LIST.id]);
});

test('the list page starts list and office reads in parallel and displays only API identity and rooms', async () => {
  const releases = new Map();
  fetchMock.mockImplementation((url) => new Promise((resolve) => { releases.set(url, resolve); }));
  const loading = ListPage({ ...props({ id: LIST.id }), searchParams: Promise.resolve({ estado: 'vazio' }) })
    .catch((error) => error);
  await vi.waitFor(() => expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
    'http://localhost:8080/api/lists/' + LIST.id, 'http://localhost:8080/api/office',
  ].sort()));
  const office = { ...OFFICE, name: 'Ateliê Horizonte', members: [
    ...OFFICE.members, { id: '88888888-8888-4888-8888-888888885555', name: 'Beatriz Silva', email: 'beatriz@example.com' },
  ] };
  releases.get('http://localhost:8080/api/lists/' + LIST.id)(new Response(JSON.stringify(LIST)));
  releases.get('http://localhost:8080/api/office')(new Response(JSON.stringify(office)));
  render(await loading);
  expect(screen.getByRole('heading', { name: LIST.name })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'novo item em Cozinha' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/novo?ambiente=${ROOM.id}`);
  expect(screen.getAllByRole('link', { name: CLIENT.name }).map((link) => link.getAttribute('href')))
    .toEqual(['/clientes/' + CLIENT.id, '/clientes/' + CLIENT.id]);
  expect(screen.getByText('Ateliê Horizonte')).toBeTruthy();
  expect(screen.getByText('Ana Lima')).toBeTruthy();
  expect(screen.getByText('Beatriz Silva')).toBeTruthy();
  expect(screen.queryByText(/Paula Hooper|Isabela Machado|@fluiar|olafluiar@gmail/)).toBeNull();
});

test('a cross-office list 404 becomes notFound rather than a synthetic list', async () => {
  fetchMock.mockImplementation(async (url) => url.endsWith('/api/office')
    ? new Response(JSON.stringify(OFFICE))
    : new Response(JSON.stringify({ detail: 'Não encontramos o que você procurava.' }), { status: 404 }));
  await expect(ListPage(props({ id: LIST.id }))).rejects.toThrow('NEXT_NOT_FOUND');
});

test('a lists read outage is not swallowed as a successful empty page', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Tente novamente.' }), { status: 503 }));
  await expect(ListsPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
    status: 503, detail: 'Tente novamente.',
  });
});

test('client metadata and detail both consume the authoritative private client endpoint', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(CLIENT)));
  expect(await clientMetadata(props({ id: CLIENT.id }))).toEqual({ title: CLIENT.name });
  render(await ClientPage({ ...props({ id: CLIENT.id }), searchParams: Promise.resolve({ estado: 'vazio' }) }));
  expect(screen.getByRole('heading', { name: CLIENT.name })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Listas de compras · 1' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Casa nova' }).getAttribute('href')).toBe('/listas/' + LIST.id);
  expect(screen.getByText('(31) 99999-8888')).toBeTruthy();
  expect(screen.getByText('Cliente desde 31 de outubro de 2026')).toBeTruthy();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'http://localhost:8080/api/clients/' + CLIENT.id, 'http://localhost:8080/api/clients/' + CLIENT.id,
  ]);
});

test('the clients page loads API summaries and ignores a prototype empty query', async () => {
  const summary = { id: CLIENT.id, name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone,
    createdAt: CLIENT.createdAt, updatedAt: CLIENT.updatedAt, listCount: 7 };
  fetchMock.mockImplementation(async () => new Response(JSON.stringify([summary])));
  render(await ClientsPage({ searchParams: Promise.resolve({ estado: 'vazio' }) }));
  expect(screen.getByRole('link', { name: CLIENT.name })).toBeTruthy();
  expect(screen.getByText('7')).toBeTruthy();
  expect(screen.getByText('Cliente desde 31 out 2026')).toBeTruthy();
  expect(screen.getByText('(31) 99999-8888')).toBeTruthy();
  expect(screen.queryByText('Nenhum cliente por aqui ainda')).toBeNull();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['http://localhost:8080/api/clients']);
});

test('a clients GET outage renders the error boundary, not a successful empty clients page', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ detail: 'Tente novamente.' }), { status: 503 }));
  const result = await ClientsPage({ searchParams: Promise.resolve({}) }).catch((error) => error);
  expect(result).toMatchObject({ status: 503, detail: 'Tente novamente.' });
  render(<PrivateError error={result} reset={vi.fn()} />);
  expect(screen.getByText('Não conseguimos carregar esta página.')).toBeTruthy();
  expect(screen.queryByText('Nenhum cliente por aqui ainda')).toBeNull();
});

test.each([['detail', ClientPage], ['edit', EditClientPage], ['metadata', clientMetadata]])(
  'a cross-office client 404 becomes notFound in %s', async (_, Page) => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ detail: 'Não encontramos o que você procurava.' }), { status: 404 }));
    await expect(Page(props({ id: CLIENT.id }))).rejects.toThrow('NEXT_NOT_FOUND');
  },
);

test('edit client forms are keyed by the returned UUID so navigation cannot retain another draft', async () => {
  const second = { ...CLIENT, id: '11111111-1111-4111-8111-111111115555', name: 'Beatriz Silva', lists: [] };
  fetchMock.mockImplementation(async (url) => new Response(JSON.stringify(url.endsWith(CLIENT.id) ? CLIENT : second)));
  const view = render(await EditClientPage(props({ id: CLIENT.id })));
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Rascunho' } });
  view.rerender(await EditClientPage(props({ id: second.id })));
  expect(screen.getByLabelText('Nome completo').value).toBe('Beatriz Silva');
  expect(screen.getByLabelText('Telefone').value).toBe('(31) 99999-8888');
});
