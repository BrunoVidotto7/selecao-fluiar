import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './Display';

test('an empty API list is not completed', () => {
  render(<StatusBadge total={0} done={0} completed={false} />);
  expect(screen.queryByText('Concluída')).toBeNull();
  expect(screen.queryByText('Sem produtos')).not.toBeNull();
});

test('completion uses the API flag rather than equal counts', () => {
  render(<StatusBadge total={2} done={2} completed={false} />);
  expect(screen.queryByText('Concluída')).toBeNull();
  expect(screen.queryByText('0 pendentes')).not.toBeNull();
});

test('a completed API list displays its completion badge', () => {
  render(<StatusBadge total={3} done={3} completed />);
  expect(screen.getByText('Concluída')).toBeTruthy();
});
