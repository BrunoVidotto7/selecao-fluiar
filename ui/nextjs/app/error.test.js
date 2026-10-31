import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RootError from './error';
import AppError from './(app)/error';
import AuthError from './(auth)/error';
import Loading from './(app)/loading';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
beforeEach(() => refresh.mockReset());

test.each([['root', RootError], ['private', AppError], ['auth', AuthError]])(
  'the %s boundary requests fresh server data before resetting without exposing internal details', (_, Boundary) => {
    const reset = vi.fn();
    render(<Boundary error={new Error('private SQL and token details')} reset={reset} />);

    expect(screen.queryByText(/private SQL/)).toBeNull();
    expect(screen.getByText('Não conseguimos carregar esta página.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]);
  },
);

test('the private loading fallback communicates that data is still loading', () => {
  render(<Loading />);
  expect(screen.getByRole('status').textContent).toContain('Carregando');
});
