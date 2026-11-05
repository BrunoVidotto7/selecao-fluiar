import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ClientShoppingList from './ClientShoppingList';
import { setClientPurchase, saveClientNotes } from './actions';
import { FeedbackProvider } from '../feedback/Feedback';
import { CLIENT_LIST, CLIENT_PRODUCT } from '@/test-support/fixtures';
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', async (original) => ({ ...(await original()), useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('./actions', () => ({ setClientPurchase: vi.fn(), saveClientNotes: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  setClientPurchase.mockResolvedValue({ ok: true, data: { ...CLIENT_PRODUCT, bought: true } });
  saveClientNotes.mockResolvedValue({ ok: true, data: CLIENT_PRODUCT });
});
test('clients can mark purchases without administrative controls or private fields', async () => {
  render(<FeedbackProvider><ClientShoppingList list={CLIENT_LIST} /></FeedbackProvider>);
  await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: `Comprado: ${CLIENT_PRODUCT.name}` })));
  expect(setClientPurchase).toHaveBeenCalledExactlyOnceWith(CLIENT_LIST.id, CLIENT_PRODUCT.id, true);
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.queryByRole('link', { name: 'Editar lista' })).toBeNull();
  expect(screen.queryByRole('spinbutton')).toBeNull();
});
test('purchase filters and counts use the saved list and do not erase note drafts', () => {
  const rendered = render(<FeedbackProvider><ClientShoppingList list={CLIENT_LIST} /></FeedbackProvider>);
  const input = screen.getByRole('textbox', { name: `Observação do cliente: ${CLIENT_PRODUCT.name}` });
  fireEvent.change(input, { target: { value: 'Unsaved note' } });
  rendered.rerender(<FeedbackProvider><ClientShoppingList list={{ ...CLIENT_LIST, updatedAt: '2026-11-04T12:00:00Z' }} /></FeedbackProvider>);
  expect(input.value).toBe('Unsaved note');
  fireEvent.click(screen.getByRole('button', { name: /Comprados/ }));
  expect(screen.getByText('Nenhum item comprado ainda.')).toBeTruthy();
});
const LUZ = { id: '55555555-5555-4555-8555-555555555552', name: 'Luminotécnica', deleted: false };
const twoCategories = {
  ...CLIENT_LIST,
  stats: { totalProducts: 2, boughtProducts: 1, pendingProducts: 1 },
  rooms: [{ ...CLIENT_LIST.rooms[0], products: [CLIENT_PRODUCT,
    { ...CLIENT_PRODUCT, id: '44444444-4444-4444-8444-444444447777', name: 'Pendente', category: LUZ, bought: true }] }],
};
const choose = (value) => fireEvent.change(screen.getByRole('combobox', { name: 'Categoria' }), { target: { value } });
test('filters items by category and shows the label', () => {
  render(<FeedbackProvider><ClientShoppingList list={twoCategories} /></FeedbackProvider>);
  expect(screen.getAllByText('Luminotécnica', { selector: '.ro-cat' })).toHaveLength(1);
  choose(LUZ.id);
  expect(screen.getByText('Pendente').closest('tr').hidden).toBe(false);
  expect(screen.getByText(CLIENT_PRODUCT.name).closest('tr').hidden).toBe(true);
});
test('combines category with status and keeps the category', () => {
  render(<FeedbackProvider><ClientShoppingList list={twoCategories} /></FeedbackProvider>);
  choose(LUZ.id);
  fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));
  expect(screen.getByText('Nenhum item desta categoria com esse status.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
  expect(screen.getByRole('combobox', { name: 'Categoria' }).value).toBe(LUZ.id);
});
test('falls back to all when the category disappears', () => {
  const rendered = render(<FeedbackProvider><ClientShoppingList list={twoCategories} /></FeedbackProvider>);
  choose(LUZ.id);
  const only = { ...twoCategories, rooms: [{ ...twoCategories.rooms[0], products: [CLIENT_PRODUCT] }] };
  rendered.rerender(<FeedbackProvider><ClientShoppingList list={only} /></FeedbackProvider>);
  expect(screen.getByRole('combobox', { name: 'Categoria' }).value).toBe('');
});
