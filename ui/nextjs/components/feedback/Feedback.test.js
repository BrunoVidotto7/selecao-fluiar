import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FeedbackProvider, useConfirm } from './Feedback';

vi.mock('next/navigation', () => ({ usePathname: () => '/perfis' }));

function Page({ onConfirm }) {
  const confirm = useConfirm();
  return (
    <>
      <button type="button">Botão de fundo</button>
      <button type="button" onClick={() => confirm({ title: 'Excluir Ana?', confirmLabel: 'Excluir perfil', onConfirm })}>Excluir</button>
    </>
  );
}

function openDialog(onConfirm = vi.fn(), key = 'cheio') {
  const view = render(<FeedbackProvider><Page key={key} onConfirm={onConfirm} /></FeedbackProvider>);
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
  fireEvent.click(screen.getByRole('button', { name: 'Excluir perfil' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('leaving the page that opened a confirmation discards it and its action', () => {
  const { onConfirm, view } = openDialog();
  view.rerender(<FeedbackProvider><p>Outra página</p></FeedbackProvider>);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('a query-only navigation that remounts the page (link or Back/Forward) discards its confirmation', () => {
  const { onConfirm, view } = openDialog(vi.fn(), 'cheio');
  view.rerender(<FeedbackProvider><Page key="vazio" onConfirm={onConfirm} /></FeedbackProvider>);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('re-rendering the same page keeps its confirmation open', () => {
  const { onConfirm, view } = openDialog(vi.fn(), 'cheio');
  view.rerender(<FeedbackProvider><Page key="cheio" onConfirm={onConfirm} /></FeedbackProvider>);
  expect(screen.getByRole('alertdialog')).toBeTruthy();
});

test('Tab and Shift+Tab keep the focus inside the confirmation', () => {
  openDialog();
  const cancel = screen.getByRole('button', { name: 'Cancelar' });
  const ok = screen.getByRole('button', { name: 'Excluir perfil' });

  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(ok);

  fireEvent.keyDown(ok, { key: 'Tab' });
  expect(document.activeElement).toBe(cancel);

  screen.getByRole('button', { name: 'Botão de fundo' }).focus();
  fireEvent.keyDown(document.activeElement, { key: 'Tab' });
  expect(document.activeElement).toBe(cancel);
});
