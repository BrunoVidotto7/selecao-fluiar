import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProfileNotes from './ProfileNotes';
import { FeedbackProvider } from '../feedback/Feedback';

vi.mock('next/navigation', () => ({ usePathname: () => '/listas' }));

const NOTES = [
  { clientId: 'c1', clientName: 'Mariana', text: 'Prefiro cinza', updatedAt: '2026-11-05T12:00:00Z' },
  { clientId: 'c2', clientName: 'Paulo', text: 'Muito caro', updatedAt: '2026-11-06T12:00:00Z' },
];

test('lists each note as name and text, read only without onDelete', () => {
  render(<FeedbackProvider><ProfileNotes notes={NOTES} productName="Batedeira" /></FeedbackProvider>);
  expect(screen.getByText('Observações dos perfis')).toBeTruthy();
  expect(screen.getByText('Mariana: Prefiro cinza')).toBeTruthy();
  expect(screen.getByText('Paulo: Muito caro')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('renders nothing without notes', () => {
  const { container } = render(<FeedbackProvider><ProfileNotes notes={[]} productName="Batedeira" onDelete={vi.fn()} /></FeedbackProvider>);
  expect(container.querySelector('.profile-notes')).toBeNull();
  expect(screen.queryByText('Observações dos perfis')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

test('deleting asks for confirmation and then calls onDelete with the profile id', () => {
  const onDelete = vi.fn();
  render(<FeedbackProvider><ProfileNotes notes={NOTES} productName="Batedeira" onDelete={onDelete} /></FeedbackProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir observação de Paulo' }));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(onDelete).toHaveBeenCalledWith('c2');
});
