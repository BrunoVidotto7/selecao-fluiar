import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Page from './page';
import { CLIENT, DASHBOARD, ME } from '@/test-support/fixtures';

const { cookies, fetchMock, redirect } = vi.hoisted(() => ({
  cookies: vi.fn(), fetchMock: vi.fn(), redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({ redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const props = { searchParams: Promise.resolve({ estado: 'vazio' }) };
const COUNTS = {
  clientCount: 12, listCount: 9, pendingProductCount: 17, totalProductCount: 21,
  completedListCount: 2, clientsCreatedThisMonth: 3, listsWithPendingProductsCount: 4,
  recentClients: [], recentLists: [],
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'jwt' }) });
  fetchMock.mockReset().mockImplementation(async (url) => json(url.endsWith('/api/me') ? ME : COUNTS));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('the dashboard uses all seven API counts rather than recent-array lengths and ignores demo empty queries', async () => {
  render(await Page(props));
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText('9')).toBeTruthy();
  expect(screen.getByText('17')).toBeTruthy();
  expect(screen.getByText('3 novos este mês')).toBeTruthy();
  expect(screen.getByText('2 concluídas')).toBeTruthy();
  expect(screen.getByText('de 21 itens nas listas')).toBeTruthy();
  expect(screen.getByText('Há 17 itens esperando compra em 4 listas.')).toBeTruthy();
  expect(screen.queryByText('Cadastre seu primeiro cliente')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Olá, Ana' })).toBeTruthy();
});

test('the dashboard starts identity and aggregates concurrently before either request settles', async () => {
  const releases = new Map();
  fetchMock.mockImplementation((url) => new Promise((resolve) => { releases.set(url, resolve); }));
  const loading = Page(props);
  await vi.waitFor(() => expect([...releases.keys()].sort()).toEqual([
    'http://localhost:8080/api/dashboard', 'http://localhost:8080/api/me',
  ]));
  releases.get('http://localhost:8080/api/me')(json(ME));
  releases.get('http://localhost:8080/api/dashboard')(json(COUNTS));
  render(await loading);
  expect(screen.getByText('12')).toBeTruthy();
});

test('only API recent arrays feed recent cards without client lookups or prototype contacts', async () => {
  fetchMock.mockImplementation(async (url) => json(url.endsWith('/api/me') ? ME : { ...COUNTS, ...DASHBOARD, clientCount: 12 }));
  render(await Page({ searchParams: Promise.resolve({}) }));
  const recentClients = within(screen.getByRole('heading', { name: 'Clientes recentes' }).closest('section'));
  expect(recentClients.getByRole('link', { name: /Mariana Souza/ }).getAttribute('href')).toBe('/clientes/' + CLIENT.id);
  expect(screen.getByRole('link', { name: /Casa nova/ }).getAttribute('href')).toBe('/listas/' + DASHBOARD.recentLists[0].id);
  expect(screen.getByText('1 lista')).toBeTruthy();
  expect(screen.getByText('0 de 1 comprados')).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
  expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
    'http://localhost:8080/api/dashboard', 'http://localhost:8080/api/me',
  ]);
  expect(screen.queryByText(/Paula|Marina Duarte|Sérgio Hooper/)).toBeNull();
});

test('the greeting shows the real first name and current Sao Paulo calendar date', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T01:30:00Z'));
  fetchMock.mockImplementation(async (url) => json(url.endsWith('/api/me') ? { ...ME, name: 'Beatriz Silva' } : COUNTS));
  render(await Page(props));
  expect(screen.getByRole('heading', { name: 'Olá, Beatriz' })).toBeTruthy();
  expect(screen.getByText(/sábado, 31 de outubro/i)).toBeTruthy();
  expect(screen.queryByText(/Sexta-feira/)).toBeNull();
});

test.each([
  [0, 0, true],
  [1, 0, false],
  [0, 1, false],
])('first-use state depends on API client/list counts %i/%i', async (clientCount, listCount, empty) => {
  fetchMock.mockImplementation(async (url) => json(url.endsWith('/api/me') ? ME
    : { ...COUNTS, clientCount, listCount, pendingProductCount: 0 }));
  render(await Page(props));
  expect(Boolean(screen.queryByText('Cadastre seu primeiro cliente'))).toBe(empty);
});

test('dashboard read failure propagates to the boundary instead of the empty first-use state', async () => {
  fetchMock.mockImplementation(async (url) => url.endsWith('/api/me') ? json(ME) : json({ detail: 'Tente novamente.' }, 503));
  await expect(Page(props)).rejects.toMatchObject({ status: 503, detail: 'Tente novamente.' });
  expect(screen.queryByText('Cadastre seu primeiro cliente')).toBeNull();
});
