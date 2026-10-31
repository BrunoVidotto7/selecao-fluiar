import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import ForgotPasswordPage from '@/app/(auth)/recuperar-senha/page';
import { ForgotPasswordForm, LoginForm, ResetPasswordForm, SignupForm } from './AuthForms';
import { FeedbackProvider } from '../feedback/Feedback';
import { ME } from '@/test-support/fixtures';
import { login, signup } from './actions';

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => {
  const { unstable_rethrow } = await importOriginal();
  return { useRouter: () => ({ push, refresh }), usePathname: () => '/login', unstable_rethrow };
});
vi.mock('./actions', () => ({ login: vi.fn(), signup: vi.fn() }));

const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });
const LOGIN_ERROR = /E-mail ou senha incorretos/;
const SENT_TITLE = /caixa de entrada/;
const SERVER_DELAY_MS = 650;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  login.mockReset().mockResolvedValue({ ok: true, data: ME });
  signup.mockReset().mockResolvedValue({ ok: true, data: ME });
});
afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name) => {
  fireEvent.click(screen.getByRole('button', { name }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
};

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

const renderForm = (Form) => render(<FeedbackProvider><Form /></FeedbackProvider>);
const fillLogin = (password = 'password123') => { type('E-mail', ME.email); type('Senha', password); };
const fillSignup = (password = 'password123') => {
  type('Nome completo', ME.name);
  type('E-mail', ME.email);
  type('Senha', password);
  type('Confirme a senha', password);
};
const submitReal = async (name) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); }); };

test('login starts without fake credentials or prototype copy and remembers the device by default', () => {
  renderForm(LoginForm);
  expect(screen.getByLabelText('E-mail').value).toBe('');
  expect(screen.getByLabelText('Senha').value).toBe('');
  expect(screen.getByRole('checkbox', { name: 'Manter conectada neste aparelho' }).checked).toBe(true);
  expect(screen.queryByText(/Protótipo/)).toBeNull();
});

test('invalid credentials show the API detail in a toast and stay on login', async () => {
  login.mockResolvedValue({ ok: false, status: 401, detail: 'E-mail ou senha incorretos.', errors: {} });
  renderForm(LoginForm);
  fillLogin();
  await submitReal('Entrar');
  expect(screen.getByRole('status').textContent).toContain('E-mail ou senha incorretos.');
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('login sends the checked remember-me choice and welcomes the real user', async () => {
  renderForm(LoginForm);
  fillLogin();
  await submitReal('Entrar');
  expect(login).toHaveBeenCalledExactlyOnceWith({ email: ME.email, password: 'password123', rememberMe: true });
  expect(push).toHaveBeenCalledWith('/dashboard');
  expect(refresh).toHaveBeenCalledOnce();
  expect(JSON.parse(sessionStorage.getItem('flash')).m).toContain(ME.name);
});

test('login forwards the unchecked remember-me choice and never trims the password', async () => {
  renderForm(LoginForm);
  fillLogin('  Sênha1234 🔑  ');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Manter conectada neste aparelho' }));
  await submitReal('Entrar');
  expect(login).toHaveBeenCalledExactlyOnceWith({ email: ME.email, password: '  Sênha1234 🔑  ', rememberMe: false });
  expect(push).toHaveBeenCalledWith('/dashboard');
});

test('a rate-limited login displays the exact API detail without navigation', async () => {
  login.mockResolvedValue({
    ok: false, status: 429, detail: 'Muitas tentativas. Tente novamente em alguns minutos.', errors: {},
  });
  renderForm(LoginForm);
  fillLogin();
  await submitReal('Entrar');
  expect(screen.getByRole('status').textContent).toContain('Muitas tentativas. Tente novamente em alguns minutos.');
  expect(push).not.toHaveBeenCalled();
});

test('invalid local login fields focus the first error without calling the action', async () => {
  renderForm(LoginForm);
  await submitReal('Entrar');
  expect(screen.getByLabelText('E-mail').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(screen.getByLabelText('E-mail'));
  expect(login).not.toHaveBeenCalled();
});

test('signup validates confirmation and maps only name, email and the raw password before navigating', async () => {
  renderForm(SignupForm);
  await submitReal('Criar conta');
  expect(signup).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();

  fillSignup('  Sênha1234 🔑  ');
  type('Confirme a senha', 'different');
  await submitReal('Criar conta');
  expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();
  expect(signup).not.toHaveBeenCalled();

  type('Confirme a senha', '  Sênha1234 🔑  ');
  await submitReal('Criar conta');
  expect(signup).toHaveBeenCalledExactlyOnceWith({ name: ME.name, email: ME.email, password: '  Sênha1234 🔑  ' });
  expect(push).toHaveBeenCalledExactlyOnceWith('/dashboard');
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([
  ['short password', '1234567', 'Use entre 8 e 72 caracteres.'],
  ['BCrypt bytes', 'é'.repeat(37), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
])('signup rejects a %s before calling the action', async (_, password, message) => {
  renderForm(SignupForm);
  fillSignup(password);
  await submitReal('Criar conta');
  expect(screen.getByText(message)).toBeTruthy();
  expect(screen.getByLabelText('Senha').getAttribute('aria-invalid')).toBe('true');
  expect(signup).not.toHaveBeenCalled();
});

test('signup conflict binds email inline, preserves it on unrelated edits and shows API detail', async () => {
  signup.mockResolvedValue({
    ok: false, status: 409, detail: 'Este e-mail já tem uma conta.', errors: { email: 'Este e-mail já tem uma conta.' },
  });
  renderForm(SignupForm);
  fillSignup();
  await submitReal('Criar conta');
  const email = screen.getByLabelText('E-mail');
  expect(email.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(email);
  expect(document.getElementById(email.getAttribute('aria-describedby')).textContent).toBe('Este e-mail já tem uma conta.');
  expect(screen.getByRole('status').textContent).toContain('Este e-mail já tem uma conta.');
  type('Nome completo', 'Ana Maria Lima');
  fireEvent.blur(email);
  expect(email.getAttribute('aria-invalid')).toBe('true');
  type('E-mail', 'other@example.com');
  expect(email.getAttribute('aria-invalid')).toBe('false');
  expect(push).not.toHaveBeenCalled();
});

test('signup maps the server name and password errors to Portuguese input keys', async () => {
  signup.mockResolvedValue({
    ok: false, status: 400, detail: 'Revise os dados enviados.',
    errors: { name: 'Preencha este campo.', password: 'Use entre 8 e 72 caracteres.' },
  });
  renderForm(SignupForm);
  fillSignup();
  await submitReal('Criar conta');
  expect(document.activeElement).toBe(screen.getByLabelText('Nome completo'));
  expect(screen.getByLabelText('Nome completo').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('Senha').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Use entre 8 e 72 caracteres.')).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});

test.each([
  ['login', LoginForm, login, fillLogin, 'Entrar', 'Entrando…'],
  ['signup', SignupForm, signup, fillSignup, 'Criar conta', 'Criando conta…'],
])('%s remains busy and prevents duplicate submits until the real action completes', async (_, Form, action, fill, label, pendingLabel) => {
  const pending = deferred();
  action.mockImplementation(() => pending.promise);
  renderForm(Form);
  fill();
  fireEvent.click(screen.getByRole('button', { name: label }));
  const button = screen.getByRole('button', { name: pendingLabel });
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  fireEvent.submit(button.closest('form'));
  expect(action).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ ok: true, data: ME }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  expect(screen.getByRole('button', { name: label }).disabled).toBe(false);
});

test('a login action resolving after unmount does not navigate or flash', async () => {
  const pending = deferred();
  login.mockImplementation(() => pending.promise);
  const view = renderForm(LoginForm);
  fillLogin();
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(login).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => pending.resolve({ ok: true, data: ME }));
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
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

test('login ignores the retired demo query without injecting an error or resetting entered values', async () => {
  const view = render(await page(LoginPage, {}));
  expect(screen.queryByText(LOGIN_ERROR)).toBeNull();
  type('E-mail', ME.email);

  view.rerender(await page(LoginPage, { estado: 'erro' }));
  expect(screen.queryByText(LOGIN_ERROR)).toBeNull();
  expect(screen.getByLabelText('E-mail').value).toBe(ME.email);

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
