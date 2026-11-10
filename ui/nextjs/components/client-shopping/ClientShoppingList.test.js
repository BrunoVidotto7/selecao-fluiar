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
test('quantities show the pt-BR number with the unit label', () => {
  const area = { ...CLIENT_PRODUCT, id: '44444444-4444-4444-8444-444444448888', name: 'Tapete', unit: 'SQUARE_METER', quantity: 12.5 };
  const list = { ...CLIENT_LIST, rooms: [{ ...CLIENT_LIST.rooms[0], products: [{ ...CLIENT_PRODUCT, quantity: 2 }, area] }] };
  render(<FeedbackProvider><ClientShoppingList list={list} /></FeedbackProvider>);
  expect(screen.getByText('2 un.')).toBeTruthy();
  expect(screen.getByText('12,5 m²')).toBeTruthy();
});
const OTHER = { ...CLIENT_PRODUCT, id: '44444444-4444-4444-8444-444444448888', name: 'Capacho', bought: true };
const twoItems = { ...CLIENT_LIST, stats: { totalProducts: 2, boughtProducts: 1, pendingProducts: 1 },
  rooms: [{ ...CLIENT_LIST.rooms[0], products: [CLIENT_PRODUCT, OTHER] }] };
const view = (list) => <FeedbackProvider><ClientShoppingList list={list} /></FeedbackProvider>;
const sheetItems = () => [...document.body.querySelectorAll('.print-sheet tbody td:nth-child(2)')].map((td) => td.textContent);
test('print selection prints only marked items, without client header or purchase changes', () => {
  window.print = vi.fn();
  render(view(twoItems));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Imprimir: Capacho' }));
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  expect(sheetItems()).toEqual(['Capacho']);
  expect(document.body.querySelector('.print-sheet').textContent).not.toContain('Cliente:');
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir selecionados' }));
  expect(window.print).toHaveBeenCalledOnce();
  expect(setClientPurchase).not.toHaveBeenCalled();
});
test('the room checkbox selects every item of the room', () => {
  render(view(twoItems));
  fireEvent.click(screen.getByRole('checkbox', { name: `Selecionar todos de ${CLIENT_LIST.rooms[0].name}` }));
  expect(screen.getByText('2 itens selecionados')).toBeTruthy();
  expect(sheetItems()).toEqual([CLIENT_PRODUCT.name, 'Capacho']);
});
test('print selection survives a filter change and a refreshed list, and drops removed products', () => {
  const { rerender } = render(view(twoItems));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Imprimir: Capacho' }));
  fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  rerender(view({ ...twoItems, updatedAt: '2026-11-06T10:00:00Z' }));
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  rerender(view({ ...twoItems, rooms: [{ ...twoItems.rooms[0], products: [CLIENT_PRODUCT] }] }));
  expect(screen.queryByText('1 item selecionado')).toBeNull();
});
test('shows the product photo, or a placeholder icon without one', () => {
  const withImage = { ...CLIENT_PRODUCT, imageUrl: '/api/images/' + CLIENT_PRODUCT.id };
  const list = { ...CLIENT_LIST, rooms: [{ ...CLIENT_LIST.rooms[0], products: [withImage, { ...OTHER, imageUrl: null }] }] };
  const { container } = render(view(list));
  const thumbs = container.querySelectorAll('.thumb');
  expect(thumbs).toHaveLength(2);
  expect(thumbs[0].querySelector('img')?.getAttribute('src')).toBe('/images/' + CLIENT_PRODUCT.id);
  expect(thumbs[0].querySelector('img')?.getAttribute('loading')).toBe('lazy');
  expect(thumbs[1].querySelector('img')).toBeNull();
});
