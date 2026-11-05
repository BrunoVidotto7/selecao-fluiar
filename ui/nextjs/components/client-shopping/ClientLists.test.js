import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientLists from './ClientLists';
import { CLIENT_LIST_SUMMARY } from '@/test-support/fixtures';
test('client cards link to private lists without administrative actions or pricing', () => {
  render(<ClientLists lists={[CLIENT_LIST_SUMMARY]} />);
  expect(screen.getByRole('link', { name: CLIENT_LIST_SUMMARY.name }).getAttribute('href')).toBe('/my-lists/' + CLIENT_LIST_SUMMARY.id);
  expect(screen.getByText('0 de 1 comprados')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText(/R\$/)).toBeNull();
});
test('a client without lists receives a real empty state with no create action', () => {
  render(<ClientLists lists={[]} />);
  expect(screen.getByText('Nenhuma lista disponível')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});
