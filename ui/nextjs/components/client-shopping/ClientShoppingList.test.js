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
