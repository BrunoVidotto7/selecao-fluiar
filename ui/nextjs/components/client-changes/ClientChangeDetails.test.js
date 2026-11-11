import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import ClientChangeDetails from './ClientChangeDetails';
import { PRODUCT } from '@/test-support/fixtures';
const changedAt = '2026-11-05T12:00:00Z';
test('shows the authors, the purchase line and one line per note', () => {
  const { container } = render(<ClientChangeDetails product={{ ...PRODUCT, bought: false }} change={{
    productId: PRODUCT.id,
    purchase: { revision: 1, changedAt, value: true, clientId: 'c1', clientName: 'Mariana' },
    notes: [
      { clientId: 'c1', clientName: 'Mariana', revision: 2, changedAt, value: 'Nova observação' },
      { clientId: 'c2', clientName: 'Paulo', revision: 3, changedAt, value: null },
    ],
  }} />);
  expect(screen.getByText('Alterado por Mariana, Paulo')).toBeTruthy();
  expect(screen.getByText(/Marcou como comprado/)).toBeTruthy();
  expect(screen.getByText(/Última alteração do perfil: comprado/)).toBeTruthy();
  expect(screen.getByText(/Mariana · Alterou a observação/)).toBeTruthy();
  expect(screen.getByText(/Paulo · Removeu a observação/)).toBeTruthy();
  expect(container.querySelector('time').getAttribute('datetime')).toBe(changedAt);
});
test('a purchase without a known author and a purchase reversal are explicit', () => {
  render(<ClientChangeDetails product={{ ...PRODUCT, bought: false }} change={{
    productId: PRODUCT.id, purchase: { revision: 3, changedAt, value: false, clientId: 'c1', clientName: null },
  }} />);
  expect(screen.getByText('Alterado por um perfil')).toBeTruthy();
  expect(screen.getByText(/Desmarcou a compra/)).toBeTruthy();
  expect(screen.queryByText(/Última alteração do perfil/)).toBeNull();
});
test('a notes-only change names the authors in the heading', () => {
  render(<ClientChangeDetails product={PRODUCT} change={{
    productId: PRODUCT.id, notes: [{ clientId: 'c2', clientName: 'Paulo', revision: 1, changedAt, value: 'ok' }],
  }} />);
  expect(screen.getByText('Alterado por Paulo')).toBeTruthy();
});
test('the purchase line names its author, which can differ from the note author', () => {
  render(<ClientChangeDetails product={PRODUCT} change={{
    productId: PRODUCT.id,
    purchase: { revision: 1, changedAt, value: true, clientId: 'c1', clientName: 'Mariana' },
    notes: [{ clientId: 'c2', clientName: 'Paulo', revision: 2, changedAt, value: 'ok' }],
  }} />);
  expect(screen.getByText(/Mariana · Marcou como comprado/)).toBeTruthy();
  expect(screen.getByText(/Paulo · Alterou a observação/)).toBeTruthy();
});
test('an unknown purchase author is shown as a generic profile', () => {
  render(<ClientChangeDetails product={{ ...PRODUCT, bought: false }} change={{
    productId: PRODUCT.id, purchase: { revision: 3, changedAt, value: false, clientId: 'c1', clientName: null },
  }} />);
  expect(screen.getByText(/Um perfil · Desmarcou a compra/)).toBeTruthy();
});
