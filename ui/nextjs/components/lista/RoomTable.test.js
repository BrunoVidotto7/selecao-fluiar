import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomTable from './RoomTable';
import { LIST, PRODUCT, ROOM, SECOND_PRODUCT } from '@/test-support/fixtures';

vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
afterEach(() => vi.useRealTimers());

const renderRoom = (overrides = {}) => {
  const props = { room: ROOM, products: [PRODUCT], showAdd: true, listBase: `/listas/${LIST.id}`,
    pendingIds: new Set(), onToggle: vi.fn().mockResolvedValue({ ok: true, data: PRODUCT }),
    onQty: vi.fn().mockResolvedValue({ ok: true, data: PRODUCT }),
    onRemove: vi.fn().mockResolvedValue({ ok: true, data: undefined }), ...overrides };
  return { ...render(<RoomTable {...props} />), props };
};

test('the room-add link uses the actual room UUID and null price remains Sem preço', () => {
  renderRoom({ products: [{ ...PRODUCT, unitPrice: null }] });
  expect(screen.getByRole('link', { name: 'novo item em Cozinha' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/novo?ambiente=${ROOM.id}`);
  expect(screen.getByText('Sem preço')).toBeTruthy();
});

test('pendingIds disable every mutation control of that row only', () => {
  renderRoom({ products: [PRODUCT, SECOND_PRODUCT], pendingIds: new Set([PRODUCT.id]) });
  expect(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }).disabled).toBe(true);
  expect(screen.getAllByRole('spinbutton', { name: 'Quantidade' })[0].disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Remover Batedeira' }).disabled).toBe(true);
  expect(screen.getByRole('checkbox', { name: 'Comprado: Sofá' }).disabled).toBe(false);
});

test('a purchase tap validates an unfinished quantity even before blur', async () => {
  const { props } = renderRoom();
  const qty = screen.getByRole('spinbutton', { name: 'Quantidade' });
  fireEvent.change(qty, { target: { value: '' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  await act(async () => {});
  expect(props.onToggle).not.toHaveBeenCalled();
  expect(props.onQty).not.toHaveBeenCalled();
  expect(qty.value).toBe('');
  expect(qty.getAttribute('aria-invalid')).toBe('true');
});

test('a purchase tap persists a valid unblurred quantity draft without buying yet', async () => {
  let resolve;
  const onQty = vi.fn(() => new Promise((done) => { resolve = done; }));
  const { props } = renderRoom({ onQty });
  const qty = screen.getByRole('spinbutton', { name: 'Quantidade' });
  const checkbox = screen.getByRole('checkbox', { name: 'Comprado: Batedeira' });
  fireEvent.change(qty, { target: { value: '3' } });
  fireEvent.click(checkbox);
  fireEvent.click(checkbox);
  expect(onQty).toHaveBeenCalledExactlyOnceWith(PRODUCT.id, 3);
  expect(props.onToggle).not.toHaveBeenCalled();
  expect(checkbox.checked).toBe(false);
  await act(async () => resolve({ ok: true, data: { ...PRODUCT, quantity: 3 } }));
  expect(qty.value).toBe('2');
  expect(checkbox.checked).toBe(false);
});

test('the confirmation expires at 2500ms so the next tap only arms instead of deleting', () => {
  vi.useFakeTimers();
  const { props } = renderRoom();
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  act(() => vi.advanceTimersByTime(2499));
  expect(screen.getByRole('button', { name: 'Confirmar remoção de Batedeira' })).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  expect(screen.getByRole('link', { name: 'Batedeira' })).toBeTruthy();
  expect(props.onRemove).not.toHaveBeenCalled();
});

test('Enter followed by blur saves once and a failed ActionResult restores saved quantity', async () => {
  let resolve;
  const onQty = vi.fn(() => new Promise((done) => { resolve = done; }));
  const { props } = renderRoom({ onQty });
  const qty = screen.getByRole('spinbutton', { name: 'Quantidade' });
  fireEvent.change(qty, { target: { value: '3' } });
  qty.focus();
  fireEvent.keyDown(qty, { key: 'Enter' });
  fireEvent.blur(qty);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  fireEvent.click(screen.getByRole('button', { name: /remoção|Remover/ }));
  expect(onQty).toHaveBeenCalledExactlyOnceWith(PRODUCT.id, 3);
  expect(props.onToggle).not.toHaveBeenCalled();
  expect(props.onRemove).not.toHaveBeenCalled();
  await act(async () => resolve({ ok: false, status: 503, detail: 'Tente novamente.', errors: {} }));
  expect(qty.value).toBe('2');
  fireEvent.blur(qty);
  expect(onQty).toHaveBeenCalledOnce();
});

test('a confirmed server quantity replaces an unfinished draft without resetting on unchanged server props', () => {
  const view = renderRoom();
  const qty = screen.getByRole('spinbutton', { name: 'Quantidade' });
  fireEvent.change(qty, { target: { value: '' } });
  fireEvent.blur(qty);
  view.rerender(<RoomTable {...view.props} products={[{ ...PRODUCT, bought: true }]} />);
  expect(qty.value).toBe('');
  expect(qty.getAttribute('aria-invalid')).toBe('true');
  view.rerender(<RoomTable {...view.props} products={[{ ...PRODUCT, quantity: 5 }]} />);
  expect(qty.value).toBe('5');
  expect(qty.getAttribute('aria-invalid')).toBe('false');
  expect(view.props.onQty).not.toHaveBeenCalled();
});

test('unmount clears the removal confirmation timer', () => {
  vi.useFakeTimers();
  const view = renderRoom();
  const existingTimers = vi.getTimerCount();
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  expect(vi.getTimerCount()).toBe(existingTimers + 1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('admin item shows store source and partial sync status', () => {
  renderRoom({ products: [{ ...PRODUCT, storeSync: { sourceUrl: 'https://moveca.com.br/products/chair', store: 'moveca', enabled: true, status: 'partial', lastSyncedAt: '2026-11-04T12:00:00Z' } }] });
  expect(screen.getByRole('link', { name: 'Origem: Moveca' }).getAttribute('href')).toBe('https://moveca.com.br/products/chair');
  expect(screen.getByText(/Atualização parcial/)).toBeTruthy();
  expect(screen.getByText(/Última atualização completa:/)).toBeTruthy();
});
