import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NewProductPage from '@/app/(app)/listas/[id]/produtos/novo/page';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), notFound: vi.fn() }));

const SERVER_DELAY_MS = 650;
const CHOOSE_ROOM = 'Escolha o ambiente do produto.';
const newProductPage = (query) => NewProductPage({ params: Promise.resolve({ id: 'lista-da-casa' }), searchParams: Promise.resolve(query) });

afterEach(() => { vi.useRealTimers(); push.mockClear(); });

test('the new product form resets its room and draft when only the query changes', async () => {
  const view = render(await newProductPage({ ambiente: 'Cozinha' }));
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Rascunho' } });

  view.rerender(await newProductPage({}));
  expect(screen.getByLabelText('Ambiente').value).toBe('');
  expect(screen.getByLabelText('Nome do produto').value).toBe('');
});

test.each([['0'], ['-2'], ['']])('submitting with Enter rejects the quantity %j', async (qtd) => {
  vi.useFakeTimers();
  render(await newProductPage({ ambiente: 'Cozinha' }));
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira' } });
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: qtd } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar produto' }).closest('form'));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));

  expect(screen.getByLabelText('Quantidade').getAttribute('aria-invalid')).toBe('true');
  expect(push).not.toHaveBeenCalled();
});

test('a known room in the query is preselected', async () => {
  render(await newProductPage({ ambiente: 'Cozinha' }));
  expect(screen.getByLabelText('Ambiente').value).toBe('Cozinha');
});

test.each([['inexistente'], [['Cozinha', 'Lavanderia']]])('an invalid room query (%j) still requires choosing a room', async (ambiente) => {
  vi.useFakeTimers();
  render(await newProductPage({ ambiente }));
  expect(screen.getByLabelText('Ambiente').value).toBe('');

  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar produto' }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));

  expect(screen.getByText(CHOOSE_ROOM)).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});
