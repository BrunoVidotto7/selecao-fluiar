import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NewListPage from '@/app/(app)/listas/nova/page';
import ListsPage from '@/app/(app)/listas/page';
import DashboardPage from '@/app/(app)/dashboard/page';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const SERVER_DELAY_MS = 650;
const CHOOSE_CLIENT = 'Escolha o cliente desta lista.';
const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });

afterEach(() => { vi.useRealTimers(); push.mockClear(); });

function submitList(name) {
  fireEvent.change(screen.getByLabelText('Nome da lista'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
}

test('the lists page follows the empty-state query when only the query changes', async () => {
  const view = render(await page(ListsPage, {}));
  expect(screen.getByRole('link', { name: 'Home office' })).toBeTruthy();

  view.rerender(await page(ListsPage, { estado: 'vazio' }));
  expect(screen.getByText('Nenhuma lista criada')).toBeTruthy();

  view.rerender(await page(ListsPage, {}));
  expect(screen.queryByText('Nenhuma lista criada')).toBeNull();
});

test('list status filter and search combine', async () => {
  render(await page(ListsPage, {}));
  fireEvent.click(screen.getByRole('button', { name: 'Concluídas' }));
  expect(screen.getByRole('link', { name: 'Enxoval do apartamento' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Home office' })).toBeNull();

  fireEvent.change(screen.getByLabelText('Pesquisar listas'), { target: { value: 'home' } });
  expect(screen.getByText(/Nenhuma lista encontrada/)).toBeTruthy();
});

test('the list form requires a name and a client', async () => {
  vi.useFakeTimers();
  render(await page(NewListPage, {}));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
  expect(screen.getByText('Preencha este campo.')).toBeTruthy();
  expect(screen.getByText(CHOOSE_CLIENT)).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});

test('the dashboard shows the summary, or the first-steps state when empty', async () => {
  const view = render(await page(DashboardPage, {}));
  expect(screen.getByText('Clientes recentes')).toBeTruthy();

  view.rerender(await page(DashboardPage, { estado: 'vazio' }));
  expect(screen.getByText('Cadastre seu primeiro cliente')).toBeTruthy();
});

test('the new list form resets its client when only the query changes', async () => {
  const view = render(await page(NewListPage, { cliente: 'sergio-hooper' }));
  view.rerender(await page(NewListPage, {}));
  expect(screen.getByLabelText('Cliente').value).toBe('');
});

test('a known client in the query is preselected in the new list form', async () => {
  render(await page(NewListPage, { cliente: 'sergio-hooper' }));
  expect(screen.getByLabelText('Cliente').value).toBe('sergio-hooper');
});

test.each([['inexistente'], [['sergio-hooper', 'marina-duarte']]])('an invalid client query (%j) still requires choosing a client', async (cliente) => {
  vi.useFakeTimers();
  render(await page(NewListPage, { cliente }));
  expect(screen.getByLabelText('Cliente').value).toBe('');

  submitList('Lista nova');
  expect(screen.getByText(CHOOSE_CLIENT)).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});
