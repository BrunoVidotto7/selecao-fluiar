import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import InvitationForm from './InvitationForm';
import { acceptInvitation } from './actions';
import { FeedbackProvider } from '../feedback/Feedback';
import { ME } from '@/test-support/fixtures';

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => {
  const { unstable_rethrow } = await importOriginal();
  return { useRouter: () => ({ push, refresh }), usePathname: () => '/convite', unstable_rethrow };
});
vi.mock('./actions', () => ({ acceptInvitation: vi.fn() }));

const TOKEN = 'a'.repeat(43);
const INFO = { email: 'nova@example.com', officeName: 'Ateliê Horizonte', invitedByName: 'Ana Lima' };
const USER = { ...ME, name: 'Nova Arquiteta', email: INFO.email, officeName: INFO.officeName };
const SUBMIT_LABEL = 'Criar conta e aceitar convite';
const renderForm = () => render(<FeedbackProvider><InvitationForm token={TOKEN} invitation={INFO} /></FeedbackProvider>);
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = (password = 'password123') => {
  type('Nome completo', 'Nova Arquiteta'); type('Senha', password); type('Confirme a senha', password);
};
const submit = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL })); });
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  acceptInvitation.mockReset().mockResolvedValue({ ok: true, data: USER });
  sessionStorage.clear();
});
afterEach(() => { sessionStorage.clear(); });

test('the inspected invitation fixes email and office and explains the browser account switch before submission', () => {
  const { container } = renderForm();
  expect(container.textContent).toContain('Este convite cria uma conta para nova@example.com no escritório Ateliê Horizonte. Ao aceitar, você entrará nessa conta neste navegador.');
  expect(container.textContent).toContain('Ana Lima');
  expect(screen.queryByRole('textbox', { name: 'E-mail' })).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Escritório' })).toBeNull();
  expect(acceptInvitation).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('invitation acceptance cannot choose its office or email', async () => {
  renderForm();
  fill();
  await submit();
  expect(acceptInvitation).toHaveBeenCalledExactlyOnceWith(TOKEN, { name: 'Nova Arquiteta', password: 'password123' });
  expect(push).toHaveBeenCalledExactlyOnceWith('/dashboard');
  expect(refresh).toHaveBeenCalledOnce();
  expect(JSON.parse(sessionStorage.getItem('flash')).m).toContain('Nova Arquiteta');
});

test('mismatched passwords prevent explicit acceptance', async () => {
  renderForm();
  fill();
  type('Confirme a senha', 'different123');
  await submit();
  expect(screen.queryByText('As senhas não são iguais.')).not.toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText('Confirme a senha'));
  expect(acceptInvitation).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test.each([
  ['name required', '', 'password123', 'Preencha este campo.'],
  ['name limit', 'n'.repeat(121), 'password123', 'Use no máximo 120 caracteres.'],
  ['short password', 'Nova Arquiteta', '1234567', 'Use entre 8 e 72 caracteres.'],
  ['BCrypt byte limit', 'Nova Arquiteta', 'é'.repeat(37), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
])('%s prevents acceptance before a write', async (_, name, password, detail) => {
  renderForm();
  fill(password);
  type('Nome completo', name);
  await submit();
  expect(screen.queryByText(detail)).not.toBeNull();
  expect(acceptInvitation).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('acceptance sends passwords without trimming spaces or non-ASCII characters', async () => {
  renderForm();
  fill('  Sênha1234 🔑  ');
  await submit();
  expect(acceptInvitation).toHaveBeenCalledExactlyOnceWith(TOKEN, { name: 'Nova Arquiteta', password: '  Sênha1234 🔑  ' });
  expect(push).toHaveBeenCalledWith('/dashboard');
});

test.each([
  ['a token revoked between inspection and acceptance cannot succeed', 400, 'Este link expirou ou já foi usado. Peça um novo.', {}],
  ['a duplicate account cannot succeed', 409, 'Este e-mail já tem uma conta.', { email: 'Este e-mail já tem uma conta.' }],
  ['an upstream failure cannot succeed', 503, 'Não conseguimos conectar à API. Tente novamente.', {}],
])('%s', async (_, status, detail, errors) => {
  acceptInvitation.mockResolvedValue({ ok: false, status, detail, errors });
  renderForm();
  fill();
  await submit();
  expect(screen.getByRole('status').textContent).toContain(detail);
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
  expect(screen.getByRole('button', { name: SUBMIT_LABEL }).disabled).toBe(false);
});

test('API name and password errors map to the invitation fields', async () => {
  acceptInvitation.mockResolvedValue({
    ok: false, status: 400, detail: 'Revise os campos destacados.',
    errors: { name: 'Preencha este campo.', password: 'Use entre 8 e 72 caracteres.' },
  });
  renderForm();
  fill();
  await submit();
  expect(screen.getByLabelText('Nome completo').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('Senha').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(screen.getByLabelText('Nome completo'));
  expect(push).not.toHaveBeenCalled();
});

test('acceptance remains pending and blocks duplicate submits until the server completes', async () => {
  const pending = deferred();
  acceptInvitation.mockImplementation(() => pending.promise);
  renderForm();
  fill();
  const button = screen.getByRole('button', { name: SUBMIT_LABEL });
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  fireEvent.submit(button.closest('form'));
  expect(acceptInvitation).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ ok: true, data: USER }));
  expect(push).toHaveBeenCalledWith('/dashboard');
  expect(refresh).toHaveBeenCalledOnce();
});

test('a late acceptance result after unmount does not navigate or flash', async () => {
  const pending = deferred();
  acceptInvitation.mockImplementation(() => pending.promise);
  const view = renderForm();
  fill();
  fireEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));
  expect(acceptInvitation).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => pending.resolve({ ok: true, data: USER }));
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});
