import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ShoppingList from './ShoppingList';

afterEach(() => vi.useRealTimers());

const fullRooms = [
  { name: 'Cozinha', items: [
    { id: 'a', name: 'Batedeira', links: [], bought: false, qty: 2, price: 10 },
    { id: 'b', name: 'Capacho', links: [], bought: true, qty: 1, price: 5 },
  ] },
  { name: 'Lavanderia', items: [{ id: 'c', name: 'Varal', links: [['https://loja.com.br/varal', 'Opção leve']], bought: false, qty: 1, price: 15 }] },
];
const renderFull = () => render(<ShoppingList list={{ id: 'l', name: 'Lista da casa' }} client={{ id: 'c', name: 'Ana' }} rooms={fullRooms} />);
const summary = (container) => container.querySelector('.summary').textContent;

test('the summary counts items and totals the estimated and remaining amounts', () => {
  const { container } = renderFull();
  expect(summary(container)).toMatch(/Itens3Comprados1Pendentes2Estimado R\$\s40,00 · faltam R\$\s35,00/);
});

test('marking an item as bought and changing a quantity update the summary', () => {
  const { container } = renderFull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  expect(summary(container)).toMatch(/Comprados2Pendentes1Estimado R\$\s40,00 · faltam R\$\s15,00/);

  const qty = screen.getAllByLabelText('Quantidade')[0];
  fireEvent.change(qty, { target: { value: '3' } });
  fireEvent.blur(qty);
  expect(summary(container)).toMatch(/Estimado R\$\s50,00/);
});

test('the filters show only bought or only pending items', () => {
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: /^Comprados/ }));
  expect(screen.getByRole('link', { name: 'Capacho' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Batedeira' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: /^Pendentes/ }));
  expect(screen.queryByRole('link', { name: 'Capacho' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Varal' })).toBeTruthy();
});

test('an armed remove button disarms after 2.5 s and keeps the item', () => {
  vi.useFakeTimers();
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Remover Varal' }));
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.getByRole('button', { name: 'Remover Varal' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Varal' })).toBeTruthy();
});

test('the client view is read-only and keeps the store links and notes', () => {
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.queryByRole('link', { name: 'Editar Batedeira' })).toBeNull();
  expect(screen.getByText('Opção leve')).toBeTruthy();
});

const list = { id: 'lista-da-casa', name: 'Lista de compras da casa' };
const client = { id: 'sergio-hooper', name: 'Sérgio Hooper' };
const rooms = [{ name: 'Cozinha', items: [{ id: 'p1', name: 'Extensão', links: [], bought: false, qty: 1, price: 10 }] }];
const EMPTY = 'Esta lista ainda não tem produtos';

test('the two-step remove button names the product and the pending confirmation', () => {
  render(<ShoppingList list={list} client={client} rooms={rooms} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remover Extensão' }));
  expect(screen.getByRole('button', { name: 'Confirmar remoção de Extensão' })).toBeTruthy();
});

test('removing the last product shows the empty list state in both modes', () => {
  render(<ShoppingList list={list} client={client} rooms={rooms} />);
  const remove = screen.getByRole('button', { name: /Remover/ });
  fireEvent.click(remove);
  fireEvent.click(remove);

  expect(screen.getByText(EMPTY)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.getByText(EMPTY)).toBeTruthy();
});
