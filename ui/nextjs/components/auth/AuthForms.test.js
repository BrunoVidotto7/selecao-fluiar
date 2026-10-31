import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import ForgotPasswordPage from '@/app/(auth)/recuperar-senha/page';
import { ForgotPasswordForm, LoginForm, ResetPasswordForm, SignupForm } from './AuthForms';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });
const LOGIN_ERROR = /E-mail ou senha incorretos/;
const SENT_TITLE = /caixa de entrada/;
const SERVER_DELAY_MS = 650;

afterEach(() => { vi.useRealTimers(); push.mockClear(); });

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name) => {
  fireEvent.click(screen.getByRole('button', { name }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
};

test('login with the simulated wrong password shows the error and stays on the page', () => {
  vi.useFakeTimers();
  render(<LoginForm />);
  type('Senha', 'erro');
  submit('Entrar');
  expect(screen.getByText(LOGIN_ERROR)).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});

test('login with any other password goes to the dashboard', () => {
  vi.useFakeTimers();
  render(<LoginForm />);
  type('Senha', 'qualquer');
  submit('Entrar');
  expect(push).toHaveBeenCalledWith('/dashboard');
});

test('signup validates the form and then opens the empty dashboard', () => {
  vi.useFakeTimers();
  render(<SignupForm />);
  submit('Criar conta');
  expect(push).not.toHaveBeenCalled();

  type('Nome completo', 'Ana Lima');
  type('E-mail', 'ana@escritorio.com.br');
  type('Senha', 'Senha1234');
  type('Confirme a senha', 'Senha1234');
  submit('Criar conta');
  expect(push).toHaveBeenCalledWith('/dashboard?estado=vazio');
});

test('password reset rejects different passwords and confirms equal ones', () => {
  vi.useFakeTimers();
  render(<ResetPasswordForm />);
  type('Nova senha', 'Senha1234');
  type('Confirme a nova senha', 'Senha9999');
  submit('Salvar nova senha');
  expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();

  type('Confirme a nova senha', 'Senha1234');
  submit('Salvar nova senha');
  expect(screen.getByText(/redefinida/)).toBeTruthy();
});

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
