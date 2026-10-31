import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import ForgotPasswordPage from '@/app/(auth)/recuperar-senha/page';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });
const LOGIN_ERROR = /E-mail ou senha incorretos/;
const SENT_TITLE = /caixa de entrada/;

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
