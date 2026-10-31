import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FeedbackProvider, useConfirm } from './Feedback';

vi.mock('next/navigation', () => ({ usePathname: () => '/clientes' }));

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
  render(<FeedbackProvider><Page onConfirm={onConfirm} /></FeedbackProvider>);
  const opener = screen.getByRole('button', { name: 'Excluir' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onConfirm };
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
