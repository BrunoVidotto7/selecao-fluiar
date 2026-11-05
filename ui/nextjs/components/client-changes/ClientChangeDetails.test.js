import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import ClientChangeDetails from './ClientChangeDetails';
import { PRODUCT } from '@/test-support/fixtures';
const changedAt = '2026-11-05T12:00:00Z';
test('shows both latest actions and escaped client snapshots when current admin values differ', () => {
  const { container } = render(<ClientChangeDetails product={{ ...PRODUCT, bought: false, clientNotes: 'Texto atual' }} change={{
    productId: PRODUCT.id, purchase: { revision: 1, changedAt, value: true },
    notes: { revision: 2, changedAt, value: '<script>alert(1)</script>' },
  }} />);
  expect(screen.getByText('Alterado pelo cliente')).toBeTruthy();
  expect(screen.getByText(/Marcou como comprado/)).toBeTruthy();
  expect(screen.getByText(/Alterou a observação/)).toBeTruthy();
  expect(screen.getByText(/Última alteração do cliente: comprado/)).toBeTruthy();
  expect(screen.getByText(/Última alteração do cliente: <script>alert\(1\)<\/script>/)).toBeTruthy();
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('time').getAttribute('datetime')).toBe(changedAt);
});
test('removed note and purchase reversal are explicit', () => {
  render(<ClientChangeDetails product={{ ...PRODUCT, bought: false, clientNotes: null }} change={{
    productId: PRODUCT.id, purchase: { revision: 3, changedAt, value: false }, notes: { revision: 4, changedAt, value: null },
  }} />);
  expect(screen.getByText(/Desmarcou a compra/)).toBeTruthy();
  expect(screen.getByText(/Removeu a observação/)).toBeTruthy();
  expect(screen.queryByText(/Última alteração do cliente/)).toBeNull();
});
