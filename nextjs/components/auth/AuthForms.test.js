import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import ForgotPasswordPage from '@/app/(auth)/recuperar-senha/page';
import { ForgotPasswordForm } from './AuthForms';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });
const LOGIN_ERROR = /E-mail ou senha incorretos/;
const SENT_TITLE = /caixa de entrada/;
const SERVER_DELAY_MS = 650;

afterEach(() => vi.useRealTimers());

test('recovery confirmation shows the submitted email, not a later edit of the field', () => {
  vi.useFakeTimers();
  render(<ForgotPasswordForm />);
  const email = screen.getByLabelText('E-mail');

  fireEvent.change(email, { target: { value: 'ana@escritorio.com.br' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));
  fireEvent.change(email, { target: { value: 'outro' } });
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));

  expect(screen.getByText('ana@escritorio.com.br')).toBeTruthy();
  expect(screen.queryByText('outro')).toBeNull();
});

test('login preview follows the query when only the query changes', async () => {
  const view = render(await page(LoginPage, {}));
  expect(screen.queryByText(LOGIN_ERROR)).toBeNull();

  view.rerender(await page(LoginPage, { estado: 'erro' }));
  expect(screen.getByText(LOGIN_ERROR)).toBeTruthy();

  view.rerender(await page(LoginPage, {}));
  expect(screen.queryByText(LOGIN_ERROR)).toBeNull();
});

test('password recovery preview follows the query when only the query changes', async () => {
  const view = render(await page(ForgotPasswordPage, {}));
  expect(screen.getByRole('button', { name: 'Enviar link de recuperação' })).toBeTruthy();

  view.rerender(await page(ForgotPasswordPage, { estado: 'enviado' }));
  expect(screen.getByText(SENT_TITLE)).toBeTruthy();

  view.rerender(await page(ForgotPasswordPage, {}));
  expect(screen.queryByText(SENT_TITLE)).toBeNull();
});
