import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FeedbackProvider, useConfirm } from './Feedback';

const nav = vi.hoisted(() => ({ pathname: '/clientes' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

beforeEach(() => { nav.pathname = '/clientes'; });

function Page({ onConfirm }) {
  const confirm = useConfirm();
  return (
    <>
      <button type="button">Botão de fundo</button>
      <button type="button" onClick={() => confirm({ title: 'Excluir Ana?', confirmLabel: 'Excluir cliente', onConfirm })}>Excluir</button>
    </>
  );
}

function openDialog(onConfirm = vi.fn()) {
  const view = render(<FeedbackProvider><Page onConfirm={onConfirm} /></FeedbackProvider>);
  const opener = screen.getByRole('button', { name: 'Excluir' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onConfirm, view };
}

test('opening the confirmation focuses Cancel', () => {
  openDialog();
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
});

test('Cancel closes without running the action and returns focus to the opener', () => {
  const { opener, onConfirm } = openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(opener);
});

test('Escape closes the confirmation', () => {
  const { onConfirm } = openDialog();
  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('the confirm button closes the dialog and runs the action', () => {
  const { onConfirm } = openDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir cliente' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('navigating to another page discards an open confirmation and its action', () => {
  const onConfirm = vi.fn();
  const { view } = openDialog(onConfirm);

  nav.pathname = '/listas';
  view.rerender(<FeedbackProvider><Page onConfirm={onConfirm} /></FeedbackProvider>);

  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('browser history navigation (Back/Forward, even query-only) discards an open confirmation', () => {
  const { onConfirm } = openDialog();
  act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('Tab and Shift+Tab keep the focus inside the confirmation', () => {
  openDialog();
  const cancel = screen.getByRole('button', { name: 'Cancelar' });
  const ok = screen.getByRole('button', { name: 'Excluir cliente' });

  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(ok);

  fireEvent.keyDown(ok, { key: 'Tab' });
  expect(document.activeElement).toBe(cancel);

  screen.getByRole('button', { name: 'Botão de fundo' }).focus();
  fireEvent.keyDown(document.activeElement, { key: 'Tab' });
  expect(document.activeElement).toBe(cancel);
});
