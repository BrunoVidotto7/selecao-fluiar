import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { notFound } from 'next/navigation';
import Page from './page';
import PublicError from './error';
import { LIST, ME, PRODUCT, PUBLIC_LIST } from '@/test-support/fixtures';

const { cookieStore, fetchMock, refresh } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }, fetchMock: vi.fn(), refresh: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  useRouter: () => ({ refresh }),
}));
const props = (shareToken = LIST.shareToken) => ({ params: Promise.resolve({ shareToken }) });

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: 'revoked-private-jwt' });
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify(PUBLIC_LIST)));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('public lists render the public API subset without prices, identity data or editing controls', async () => {
  const view = render(await Page(props()));
  expect(screen.queryByRole('heading', { name: 'Casa nova' })).not.toBeNull();
  expect(screen.getByText('Seleção para a casa nova.')).toBeTruthy();
  expect(screen.getByText('Cozinha')).toBeTruthy();
  expect(screen.getByText('Batedeira')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByRole('link', { name: /example.com/ }).getAttribute('href')).toBe('https://example.com/batedeira');
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ver como cliente' })).toBeNull();
  expect(screen.queryByText(ME.email)).toBeNull();
  expect(screen.queryByText(PRODUCT.notes)).toBeNull();
  expect(screen.queryByText('Sem preço')).toBeNull();
  expect(view.container.querySelector('input')).toBeNull();
  expect(view.container.querySelector('nav')).toBeNull();
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/api/public/lists/' + 'a'.repeat(43),
    expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(cookieStore.get).not.toHaveBeenCalled();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('public API office members and object-shaped links appear without hard-coded contacts', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({
    ...PUBLIC_LIST, signature: { officeName: 'Ateliê Horizonte', architectNames: ['Ana Lima', 'Beatriz Silva'] },
    rooms: [{ name: 'Sala', products: [{
      name: 'Sofá', quantity: 3, bought: true, links: [{ url: 'https://loja.com/sofa', note: 'Tecido azul' }],
    }] }],
  })));
  render(await Page(props()));
  expect(screen.getByText('Ateliê Horizonte')).toBeTruthy();
  expect(screen.getByText('Ana Lima')).toBeTruthy();
  expect(screen.getByText('Beatriz Silva')).toBeTruthy();
  expect(screen.getByText('Tecido azul')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Comprado' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /loja.com/ }).getAttribute('href')).toBe('https://loja.com/sofa');
  expect(screen.queryByText(/Paula Hooper|Isabela Machado|gmail/)).toBeNull();
});

test('an empty public list has no editor CTA or private navigation', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...PUBLIC_LIST, rooms: [] })));
  const view = render(await Page(props()));
  expect(screen.getByText('Esta lista ainda não tem produtos')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  expect(view.container.textContent).not.toMatch(/Adicione|Adicionar|Gerenciar|Editar/);
  expect(view.container.querySelector('nav')).toBeNull();
  expect(screen.getByText(ME.officeName)).toBeTruthy();
});

test.each([[undefined], [null], [''], ['short'], ['a'.repeat(42)], ['a'.repeat(44)], ['a'.repeat(42) + '/'],
  ['a'.repeat(43) + '\n'], [[]]])('missing or malformed public token %j navigates to 404 before a request', async (shareToken) => {
  await expect(Page({ params: Promise.resolve({ shareToken }) })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(notFound).toHaveBeenCalledOnce();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookieStore.get).not.toHaveBeenCalled();
});

test('an old rotated token is never served from a Next cache', async () => {
  expect(renderToStaticMarkup(await Page(props()))).toContain('Batedeira');
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'Não encontramos o que você procurava.' }), { status: 404 }));
  await expect(Page(props())).rejects.toThrow('NEXT_NOT_FOUND');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.at(-1)[1].cache).toBe('no-store');
  expect(cookieStore.get).not.toHaveBeenCalled();
});

test('public metadata is generic and never includes a token or requests private data', async () => {
  const publicPage = await import('./page');
  const metadata = publicPage.generateMetadata ? await publicPage.generateMetadata(props()) : publicPage.metadata;
  expect(metadata).toMatchObject({ title: 'Lista compartilhada' });
  expect(JSON.stringify(metadata)).not.toContain(LIST.shareToken);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookieStore.get).not.toHaveBeenCalled();
});

test('transport failure reaches a retry boundary that refreshes the public read before reset', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('private proxy details'));
  const failure = await Page(props()).catch((error) => error);
  expect(failure).toMatchObject({ status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.' });
  const reset = vi.fn();
  const view = render(<PublicError error={failure} reset={reset} />);
  expect(screen.getByText('Não conseguimos carregar esta página.')).toBeTruthy();
  expect(screen.queryByText(/private proxy/)).toBeNull();
  let freshRender;
  refresh.mockImplementationOnce(() => { freshRender = Page(props()); });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })));
  expect(refresh).toHaveBeenCalledOnce();
  expect(reset).toHaveBeenCalledOnce();
  expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  view.rerender(await freshRender);
  expect(screen.getByText('Batedeira')).toBeTruthy();
  expect(screen.queryByText('Não conseguimos carregar esta página.')).toBeNull();
  expect(cookieStore.get).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.at(-1)[1].headers.get('Authorization')).toBeNull();
});

test('public boundary retry requests a new server payload and resets after refresh', async () => {
  const reset = vi.fn();
  render(<PublicError error={new Error('unavailable')} reset={reset} />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })));
  expect(refresh).toHaveBeenCalledOnce();
  expect(reset).toHaveBeenCalledOnce();
  expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]);
});
