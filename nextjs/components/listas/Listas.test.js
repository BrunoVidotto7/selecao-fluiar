import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NewListPage from '@/app/(app)/listas/nova/page';

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
