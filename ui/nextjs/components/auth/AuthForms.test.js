import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import ForgotPasswordPage from '@/app/(auth)/recuperar-senha/page';
import { ForgotPasswordForm, LoginForm, ResetPasswordForm } from './AuthForms';
import { FeedbackProvider } from '../feedback/Feedback';
import { ME, CLIENT_ME } from '@/test-support/fixtures';
import { confirmPasswordReset, login, requestPasswordReset } from './actions';

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => {
  const { unstable_rethrow } = await importOriginal();
  return { useRouter: () => ({ push, refresh }), usePathname: () => '/login', unstable_rethrow };
});
vi.mock('./actions', () => ({
  login: vi.fn(), signup: vi.fn(), requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn(),
}));

const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });
const LOGIN_ERROR = /E-mail ou senha incorretos/;
const SENT_TITLE = /caixa de entrada/;
const NON_ENUMERATING_COPY = 'Se houver uma conta com este e-mail, enviaremos um link. Ele vale por 1 hora.';
const INVALID_LINK = 'Este link expirou ou já foi usado. Peça um novo.';
const RESET_TOKEN = 'a'.repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  login.mockReset().mockResolvedValue({ ok: true, data: ME });
  requestPasswordReset.mockReset().mockResolvedValue({ ok: true, data: undefined });
  confirmPasswordReset.mockReset().mockResolvedValue({ ok: true, data: undefined });
});
afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

const renderForm = (Form, props = {}) => render(<FeedbackProvider><Form {...props} /></FeedbackProvider>);
const fillLogin = (password = 'password123') => { type('E-mail', ME.email); type('Senha', password); };
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









test.each([
  ['login', LoginForm, login, fillLogin, 'Entrar', 'Entrando…'],
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

test('reset rejects different passwords and sends the URL token and raw new password only', async () => {
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  expect(screen.queryByText(`Conta: ${ME.email}`)).not.toBeNull();
  type('Nova senha', 'Senha1234');
  type('Confirme a nova senha', 'Senha9999');
  await submitReal('Salvar nova senha');
  expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();
  expect(confirmPasswordReset).not.toHaveBeenCalled();

  type('Nova senha', '  Sênha1234 🔑  ');
  type('Confirme a nova senha', '  Sênha1234 🔑  ');
  await submitReal('Salvar nova senha');
  expect(confirmPasswordReset).toHaveBeenCalledExactlyOnceWith({ token: RESET_TOKEN, newPassword: '  Sênha1234 🔑  ' });
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).not.toBeNull();
  expect(screen.getByRole('link', { name: 'Entrar na minha conta' }).getAttribute('href')).toBe('/login');
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(login).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('recovery waits for the write and snapshots the submitted email rather than a later edit', async () => {
  const pending = deferred();
  requestPasswordReset.mockImplementationOnce(() => pending.promise);
  renderForm(ForgotPasswordForm);
  const email = screen.getByLabelText('E-mail');

  fireEvent.change(email, { target: { value: 'ana@escritorio.com.br' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));
  expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith({ email: 'ana@escritorio.com.br' });
  expect(screen.queryByText(SENT_TITLE)).toBeNull();
  const button = screen.getByRole('button', { name: 'Enviando…' });
  expect(button.disabled).toBe(true);
  fireEvent.submit(button.closest('form'));
  expect(requestPasswordReset).toHaveBeenCalledOnce();
  fireEvent.change(email, { target: { value: 'outro' } });
  await act(async () => pending.resolve({ ok: true, data: undefined }));

  expect(screen.getByText('ana@escritorio.com.br')).toBeTruthy();
  expect(screen.getByText(NON_ENUMERATING_COPY)).toBeTruthy();
  expect(screen.queryByText('outro')).toBeNull();
  expect(screen.queryByText(/Protótipo/)).toBeNull();
  expect(screen.queryByRole('link', { name: /abrir o link/ })).toBeNull();
  expect(push).not.toHaveBeenCalled();
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

test('password recovery ignores the retired sent query and preserves entered values', async () => {
  const view = render(<FeedbackProvider>{await page(ForgotPasswordPage, {})}</FeedbackProvider>);
  expect(screen.getByRole('button', { name: 'Enviar link de recuperação' })).toBeTruthy();
  type('E-mail', 'other@example.com');

  view.rerender(<FeedbackProvider>{await page(ForgotPasswordPage, { estado: 'enviado' })}</FeedbackProvider>);
  expect(screen.queryByText(SENT_TITLE)).toBeNull();
  expect(screen.getByLabelText('E-mail').value).toBe('other@example.com');
  expect(requestPasswordReset).not.toHaveBeenCalled();
});

test('resend uses the submitted address rather than a demo user and waits before showing non-enumerating feedback', async () => {
  renderForm(ForgotPasswordForm);
  type('E-mail', 'other@example.com');
  await submitReal('Enviar link de recuperação');
  expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith({ email: 'other@example.com' });
  expect(screen.queryByText(NON_ENUMERATING_COPY)).not.toBeNull();

  const pending = deferred();
  requestPasswordReset.mockImplementationOnce(() => pending.promise);
  await submitReal('Reenviar e-mail');
  expect(requestPasswordReset).toHaveBeenNthCalledWith(2, { email: 'other@example.com' });
  const button = screen.getByRole('button', { name: 'Reenviar e-mail' });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(requestPasswordReset).toHaveBeenCalledTimes(2);
  expect(document.querySelector('.toasts').textContent).toBe('');
  await act(async () => pending.resolve({ ok: true, data: undefined }));
  expect(document.querySelector('.toasts').textContent).toContain(NON_ENUMERATING_COPY);
  expect(button.disabled).toBe(false);
});

test.each([
  [429, 'Muitas tentativas. Tente novamente em alguns minutos.'],
  [503, 'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.'],
])('failed recovery request %s shows API detail, preserves the email and can retry', async (status, detail) => {
  requestPasswordReset.mockResolvedValueOnce({ ok: false, status, detail, errors: {} });
  renderForm(ForgotPasswordForm);
  type('E-mail', 'other@example.com');
  await submitReal('Enviar link de recuperação');
  expect(requestPasswordReset).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain(detail);
  expect(screen.queryByText(SENT_TITLE)).toBeNull();
  expect(screen.queryByText(NON_ENUMERATING_COPY)).toBeNull();
  expect(screen.getByLabelText('E-mail').value).toBe('other@example.com');
  expect(screen.getByRole('button', { name: 'Enviar link de recuperação' }).disabled).toBe(false);
  await submitReal('Enviar link de recuperação');
  expect(requestPasswordReset).toHaveBeenNthCalledWith(2, { email: 'other@example.com' });
  expect(screen.queryByText(NON_ENUMERATING_COPY)).not.toBeNull();
});

test.each([
  [429, 'Muitas tentativas. Tente novamente em alguns minutos.'],
  [503, 'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.'],
])('failed resend %s shows only the real failure toast and allows a retry', async (status, detail) => {
  renderForm(ForgotPasswordForm);
  type('E-mail', 'other@example.com');
  await submitReal('Enviar link de recuperação');
  expect(screen.queryByText(NON_ENUMERATING_COPY)).not.toBeNull();
  requestPasswordReset.mockResolvedValueOnce({ ok: false, status, detail, errors: {} });
  await submitReal('Reenviar e-mail');
  expect(requestPasswordReset).toHaveBeenNthCalledWith(2, { email: 'other@example.com' });
  expect(document.querySelector('.toasts').textContent).toContain(detail);
  expect(document.querySelector('.toasts').textContent).not.toContain(NON_ENUMERATING_COPY);
  expect(document.querySelector('.toasts').textContent).not.toContain('Enviamos o link de novo.');
  expect(screen.getByRole('button', { name: 'Reenviar e-mail' }).disabled).toBe(false);
  await submitReal('Reenviar e-mail');
  expect(requestPasswordReset).toHaveBeenNthCalledWith(3, { email: 'other@example.com' });
  expect(document.querySelector('.toasts').textContent).toContain(NON_ENUMERATING_COPY);
});

test('recovery validates email before writing and maps API field errors until the rejected email changes', async () => {
  renderForm(ForgotPasswordForm);
  await submitReal('Enviar link de recuperação');
  expect(requestPasswordReset).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByLabelText('E-mail'));
  type('E-mail', 'not-an-email');
  await submitReal('Enviar link de recuperação');
  expect(requestPasswordReset).not.toHaveBeenCalled();

  const message = 'Use no máximo 254 caracteres.';
  requestPasswordReset.mockResolvedValueOnce({ ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { email: message } });
  type('E-mail', 'other@example.com');
  await submitReal('Enviar link de recuperação');
  expect(screen.queryByText(message)).not.toBeNull();
  fireEvent.blur(screen.getByLabelText('E-mail'));
  expect(screen.getByLabelText('E-mail').getAttribute('aria-invalid')).toBe('true');
  type('E-mail', 'new@example.com');
  expect(screen.getByLabelText('E-mail').getAttribute('aria-invalid')).toBe('false');
});

const fillReset = (password = 'password123') => {
  type('Nova senha', password);
  type('Confirme a nova senha', password);
};

test.each([
  ['short password', '1234567', 'Use entre 8 e 72 caracteres.'],
  ['UTF-16 limit', 'a'.repeat(73), 'Use entre 8 e 72 caracteres.'],
  ['UTF-8 limit', 'é'.repeat(37), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
])('reset rejects a %s locally before calling the action', async (_, password, detail) => {
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset(password);
  await submitReal('Salvar nova senha');
  expect(screen.queryByText(detail)).not.toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText('Nova senha'));
  expect(confirmPasswordReset).not.toHaveBeenCalled();
});

test.each(['a'.repeat(72), 'é'.repeat(36), '🔑'.repeat(18)])('reset accepts an exact password boundary without trimming: %s', async (password) => {
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset(password);
  await submitReal('Salvar nova senha');
  expect(confirmPasswordReset).toHaveBeenCalledExactlyOnceWith({ token: RESET_TOKEN, newPassword: password });
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).not.toBeNull();
});

test('a reset link that expired after inspection remains actionable without a success state', async () => {
  confirmPasswordReset.mockResolvedValue({ ok: false, status: 400, detail: INVALID_LINK, errors: {} });
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset();
  await submitReal('Salvar nova senha');
  expect(confirmPasswordReset).toHaveBeenCalledExactlyOnceWith({ token: RESET_TOKEN, newPassword: 'password123' });
  expect(document.querySelector('.toasts').textContent).toContain(INVALID_LINK);
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Pedir novo link' }).getAttribute('href')).toBe('/recuperar-senha');
  expect(screen.getByRole('button', { name: 'Salvar nova senha' }).disabled).toBe(false);
  expect(push).not.toHaveBeenCalled();
});

test('reset maps newPassword errors and keeps them on confirmation edits but clears them on new-password edits', async () => {
  const message = 'Senha rejeitada pela API.';
  confirmPasswordReset.mockResolvedValueOnce({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { newPassword: message },
  });
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset();
  await submitReal('Salvar nova senha');
  expect(confirmPasswordReset).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Nova senha').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(screen.getByLabelText('Nova senha'));
  expect(screen.getByText(message)).toBeTruthy();
  type('Confirme a nova senha', 'changed123');
  fireEvent.blur(screen.getByLabelText('Nova senha'));
  expect(screen.getByText(message)).toBeTruthy();
  type('Nova senha', 'changed123');
  expect(screen.queryByText(message)).toBeNull();
  await submitReal('Salvar nova senha');
  expect(confirmPasswordReset).toHaveBeenNthCalledWith(2, { token: RESET_TOKEN, newPassword: 'changed123' });
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).not.toBeNull();
});

test('a reset field edited during the write does not receive an error for its old password', async () => {
  const pending = deferred();
  confirmPasswordReset.mockImplementationOnce(() => pending.promise);
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
  expect(confirmPasswordReset).toHaveBeenCalledExactlyOnceWith({ token: RESET_TOKEN, newPassword: 'password123' });
  fillReset('changed123');
  await act(async () => pending.resolve({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { newPassword: 'Senha rejeitada pela API.' },
  }));
  expect(screen.queryByText('Senha rejeitada pela API.')).toBeNull();
  expect(screen.getByLabelText('Nova senha').value).toBe('changed123');
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).toBeNull();
});

test.each([
  [429, 'Muitas tentativas. Tente novamente em alguns minutos.'],
  [503, 'Não conseguimos conectar à API. Tente novamente.'],
])('reset failure %s stays editable without success or navigation', async (status, detail) => {
  confirmPasswordReset.mockResolvedValueOnce({ ok: false, status, detail, errors: {} });
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset();
  await submitReal('Salvar nova senha');
  expect(confirmPasswordReset).toHaveBeenCalledOnce();
  expect(document.querySelector('.toasts').textContent).toContain(detail);
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).toBeNull();
  expect(screen.getByLabelText('Nova senha').value).toBe('password123');
  expect(screen.getByRole('button', { name: 'Salvar nova senha' }).disabled).toBe(false);
  expect(push).not.toHaveBeenCalled();
  await submitReal('Salvar nova senha');
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).not.toBeNull();
});

test('reset remains pending and prevents duplicate submits until confirmation completes', async () => {
  const pending = deferred();
  confirmPasswordReset.mockImplementationOnce(() => pending.promise);
  renderForm(ResetPasswordForm, { token: RESET_TOKEN, email: ME.email });
  fillReset();
  const button = screen.getByRole('button', { name: 'Salvar nova senha' });
  fireEvent.click(button);
  expect(confirmPasswordReset).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  fireEvent.submit(button.closest('form'));
  expect(confirmPasswordReset).toHaveBeenCalledOnce();
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).toBeNull();
  await act(async () => pending.resolve({ ok: true, data: undefined }));
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).not.toBeNull();
});

test.each([
  ['request', ForgotPasswordForm, {}, requestPasswordReset, () => type('E-mail', 'other@example.com'), 'Enviar link de recuperação'],
  ['confirmation', ResetPasswordForm, { token: RESET_TOKEN, email: ME.email }, confirmPasswordReset, fillReset, 'Salvar nova senha'],
])('a late password reset %s result after unmount produces no feedback or navigation', async (_, Form, props, action, fill, label) => {
  const pending = deferred();
  action.mockImplementationOnce(() => pending.promise);
  const view = renderForm(Form, props);
  fill();
  fireEvent.click(screen.getByRole('button', { name: label }));
  expect(action).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => pending.resolve({ ok: true, data: undefined }));
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('a late resend after leaving the sent screen produces no toast', async () => {
  const view = renderForm(ForgotPasswordForm);
  type('E-mail', 'other@example.com');
  await submitReal('Enviar link de recuperação');
  expect(requestPasswordReset).toHaveBeenCalledOnce();
  const pending = deferred();
  requestPasswordReset.mockImplementationOnce(() => pending.promise);
  await submitReal('Reenviar e-mail');
  expect(requestPasswordReset).toHaveBeenCalledTimes(2);
  view.rerender(<FeedbackProvider />);
  await act(async () => pending.resolve({ ok: true, data: undefined }));
  expect(screen.getByRole('status').textContent).toBe('');
  expect(push).not.toHaveBeenCalled();
});

test('client login opens private lists without offering public signup', async () => {
  login.mockResolvedValue({ ok: true, data: CLIENT_ME });
  renderForm(LoginForm);
  fillLogin();
  await submitReal('Entrar');
  expect(push).toHaveBeenCalledWith('/my-lists');
  expect(screen.queryByRole('link', { name: 'Criar conta' })).toBeNull();
});
