import { expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ShoppingList from './ShoppingList';

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
