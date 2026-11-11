import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import ClientChangesPanel from './ClientChangesPanel';
import { CLIENT, LIST } from '@/test-support/fixtures';
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const item = { listId: LIST.id, listName: 'Casa', clientId: CLIENT.id, clientName: 'Mariana',
  changedProductCount: 2, purchaseMarkedCount: 1, purchaseUnmarkedCount: 1, notesChangedCount: 1,
  notesRemovedCount: 1, authorNames: ['Mariana', 'Paulo'], lastChangedAt: '2026-11-05T12:00:00Z' };
const result = (data) => ({ ok: true, data: { pendingListCount: 21, page: 0, pageSize: 20, items: [item], ...data } });
test('shows independent total, client, list, each kind, timestamp and list link', () => {
  render(<ClientChangesPanel result={result()} />);
  expect(screen.getByText('21 listas com novidades')).toBeTruthy();
  expect(screen.getByText('Mariana')).toBeTruthy();
  expect(screen.getByText('Casa')).toBeTruthy();
  expect(screen.getByText('2 produtos alterados')).toBeTruthy();
  expect(screen.getByText('Por Mariana, Paulo')).toBeTruthy();
  expect(screen.getByText(/1 compra marcada/)).toBeTruthy();
  expect(screen.getByText(/1 compra desmarcada/)).toBeTruthy();
  expect(screen.getByText(/1 observação alterada/)).toBeTruthy();
  expect(screen.getByText(/1 observação removida/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Abrir lista' }).getAttribute('href')).toBe('/listas/' + LIST.id);
  expect(screen.getByRole('link', { name: 'Próxima' }).getAttribute('href')).toBe('/dashboard?changesPage=1');
});
test('omits the authors line when there are no names', () => {
  render(<ClientChangesPanel result={result({ items: [{ ...item, authorNames: [] }] })} />);
  expect(screen.queryByText(/^Por /)).toBeNull();
});
test('empty and failed reads remain distinct and retry refreshes the server', async () => {
  const view = render(<ClientChangesPanel result={result({ pendingListCount: 0, items: [] })} />);
  expect(screen.getByText('Tudo em dia! Você já viu as alterações dos seus perfis.')).toBeTruthy();
  view.rerender(<ClientChangesPanel result={{ ok: false, status: 503, detail: 'Não conseguimos conectar.', errors: {} }} />);
  expect(screen.queryByText(/Tudo em dia/)).toBeNull();
  expect(screen.getByText('Não conseguimos conectar.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await act(async () => {});
  expect(refresh).toHaveBeenCalledTimes(1);
});
test('an emptied later page still provides navigation back', () => {
  render(<ClientChangesPanel result={result({ page: 2, pendingListCount: 1, items: [] })} />);
  expect(screen.getByRole('link', { name: 'Anterior' }).getAttribute('href')).toBe('/dashboard?changesPage=1');
  expect(screen.getByRole('link', { name: 'Primeira página' }).getAttribute('href')).toBe('/dashboard');
  expect(screen.queryByRole('link', { name: 'Próxima' })).toBeNull();
});
