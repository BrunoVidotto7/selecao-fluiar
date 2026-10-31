import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import OfficeManager from './OfficeManager';
import { inviteMember, renameOffice, revokeInvitation } from './actions';
import { FeedbackProvider } from '../feedback/Feedback';
import { INVITATION, ME, OFFICE } from '@/test-support/fixtures';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/escritorio',
  unstable_rethrow: vi.fn(),
}));
vi.mock('./actions', () => ({ inviteMember: vi.fn(), renameOffice: vi.fn(), revokeInvitation: vi.fn() }));

const NOW = '2026-11-01T12:00:00Z';
const REPLACEMENT_INVITATION = { ...INVITATION, id: '99999999-9999-4999-8999-999999995555' };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  renameOffice.mockReset().mockResolvedValue({ ok: true, data: { ...OFFICE, name: 'Ateliê Ana' } });
  inviteMember.mockReset().mockResolvedValue({ ok: true, data: REPLACEMENT_INVITATION });
  revokeInvitation.mockReset().mockResolvedValue({ ok: true, data: undefined });
});
afterEach(() => { vi.useRealTimers(); });

function manager(props = {}) {
  return <FeedbackProvider><OfficeManager office={OFFICE} invitations={[INVITATION]} now={NOW} {...props} /></FeedbackProvider>;
}

function setup(props) {
  const view = render(manager(props));
  expect(screen.queryByLabelText('Nome do escritório')).toBeTruthy();
  expect(screen.queryByLabelText('E-mail do convite')).toBeTruthy();
  return view;
}

async function sendInvite(email = 'new@example.com') {
  fireEvent.change(screen.getByLabelText('E-mail do convite'), { target: { value: email } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' })); });
}

function openRevoke() {
  fireEvent.click(screen.getByRole('button', { name: 'Revogar convite para new@example.com' }));
  return screen.getByRole('alertdialog');
}

test('the office shows DTO member names and emails without removal or role controls', () => {
  const view = setup();
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Escritório de Ana Lima');
  const members = screen.getByRole('region', { name: 'Membros' });
  expect(within(members).getByText('Ana Lima')).toBeTruthy();
  expect(within(members).getByText('ana@example.com')).toBeTruthy();
  expect(within(members).queryByRole('button')).toBeNull();
  expect(within(members).queryByRole('combobox')).toBeNull();
  expect(screen.queryByText(/Paula Hooper|Arquiteta/)).toBeNull();

  view.rerender(manager({ office: { ...OFFICE, name: 'Ateliê Ana', members: [
    { id: ME.id, name: 'Ana Maria Lima', email: 'ana.maria@example.com' },
    { id: '88888888-8888-4888-8888-888888885555', name: 'João Silva', email: 'joao@example.com' },
  ] } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Ateliê Ana');
  expect(within(members).queryByText('ana@example.com')).toBeNull();
  expect(within(members).getByText('Ana Maria Lima')).toBeTruthy();
  expect(within(members).getByText('joao@example.com')).toBeTruthy();
});

test('renaming the office sends only its name and waits for persistence before feedback and refresh', async () => {
  let release;
  renameOffice.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  setup();
  fireEvent.change(screen.getByLabelText('Nome do escritório'), { target: { value: 'Ateliê Ana' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar escritório' })); });

  expect(renameOffice).toHaveBeenCalledExactlyOnceWith({ name: 'Ateliê Ana' });
  expect(inviteMember).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Salvando…' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Enviar convite' }).disabled).toBe(false);
  expect(screen.queryByText('Escritório salvo.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { release({ ok: true, data: { ...OFFICE, name: 'Ateliê Ana' } }); });
  expect(screen.getByText('Escritório salvo.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Salvar escritório' }).disabled).toBe(false);
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([
  ['', 'Preencha este campo.'],
  ['   ', 'Preencha este campo.'],
  ['a'.repeat(121), 'Use no máximo 120 caracteres.'],
])('invalid office name %j stays local and focuses its field', async (name, message) => {
  setup();
  const input = screen.getByLabelText('Nome do escritório');
  fireEvent.change(input, { target: { value: name } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar escritório' })); });
  expect(renameOffice).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe(message);
  expect(document.activeElement).toBe(input);
  expect(refresh).not.toHaveBeenCalled();
});

test('an office name at the 120-character limit can be saved', async () => {
  setup();
  fireEvent.change(screen.getByLabelText('Nome do escritório'), { target: { value: 'a'.repeat(120) } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar escritório' })); });
  expect(renameOffice).toHaveBeenCalledExactlyOnceWith({ name: 'a'.repeat(120) });
  expect(screen.getByText('Escritório salvo.')).toBeTruthy();
});

test('upstream name errors map only to nomeEscritorio and keep the exact detail', async () => {
  renameOffice.mockResolvedValueOnce({ ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { name: 'Use no máximo 120 caracteres.' } });
  setup();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar escritório' })); });
  const input = screen.getByLabelText('Nome do escritório');
  expect(input.id).toBe('nomeEscritorio');
  expect(input.getAttribute('aria-describedby')).toBe('nomeEscritorio-err');
  expect(document.getElementById('nomeEscritorio-err').textContent).toBe('Use no máximo 120 caracteres.');
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(screen.getByLabelText('E-mail do convite').getAttribute('aria-invalid')).toBe('false');
  expect(screen.queryByText('Escritório salvo.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

test('sending an existing pending email refreshes instead of duplicating local rows', async () => {
  const view = setup();
  await sendInvite();
  expect(inviteMember).toHaveBeenCalledExactlyOnceWith({ email: 'new@example.com' });
  expect(renameOffice).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getAllByText('new@example.com')).toHaveLength(1);
  view.rerender(manager({ invitations: [REPLACEMENT_INVITATION] }));
  expect(screen.getAllByText('new@example.com')).toHaveLength(1);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Revogar convite para new@example.com' })); });
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revogar convite' })); });
  expect(revokeInvitation).toHaveBeenCalledExactlyOnceWith(REPLACEMENT_INVITATION.id);
});

test('a new invitation is not fabricated locally and appears only in refreshed API props', async () => {
  const view = setup({ invitations: [] });
  expect(screen.getByText('Nenhum convite por aqui.')).toBeTruthy();
  await sendInvite();
  expect(screen.getByText('Convite enviado.')).toBeTruthy();
  expect(screen.queryByText('new@example.com')).toBeNull();
  view.rerender(manager({ invitations: [REPLACEMENT_INVITATION] }));
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(screen.queryByText('Nenhum convite por aqui.')).toBeNull();
});

test('sending waits for the real action before reporting success or refreshing', async () => {
  let release;
  inviteMember.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  setup();
  await sendInvite();
  expect(screen.getByRole('button', { name: 'Enviando…' }).disabled).toBe(true);
  expect(screen.queryByText('Convite enviado.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { release({ ok: true, data: REPLACEMENT_INVITATION }); });
  expect(screen.getByText('Convite enviado.')).toBeTruthy();
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([
  ['', 'Preencha este campo.'],
  ['not-an-email', 'Digite um e-mail válido, como nome@email.com.'],
  ['a'.repeat(243) + '@example.com', 'Use no máximo 254 caracteres.'],
])('invalid invitation email %j is rejected without sending', async (email, message) => {
  setup();
  await sendInvite(email);
  const input = screen.getByLabelText('E-mail do convite');
  expect(inviteMember).not.toHaveBeenCalled();
  expect(input.id).toBe('emailConvite');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe(message);
  expect(document.activeElement).toBe(input);
});

test('a duplicate-account email error appears under emailConvite without success', async () => {
  inviteMember.mockResolvedValueOnce({ ok: false, status: 409, detail: 'Este e-mail já tem uma conta.', errors: { email: 'Este e-mail já tem uma conta.' } });
  setup();
  await sendInvite();
  const input = screen.getByLabelText('E-mail do convite');
  expect(input.getAttribute('aria-describedby')).toBe('emailConvite-err');
  expect(document.getElementById('emailConvite-err').textContent).toBe('Este e-mail já tem uma conta.');
  expect(screen.getByRole('status').textContent).toContain('Este e-mail já tem uma conta.');
  expect(screen.queryByText('Convite enviado.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByText('new@example.com')).toBeTruthy();
});

test.each([
  [429, 'Muitas tentativas. Tente novamente em alguns minutos.'],
  [503, 'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.'],
])('an invitation failure %s shows exact upstream feedback without success', async (status, detail) => {
  inviteMember.mockResolvedValueOnce({ ok: false, status, detail, errors: {} });
  setup();
  await sendInvite();
  expect(screen.getByRole('status').textContent).toContain(detail);
  expect(screen.queryByText('Convite enviado.')).toBeNull();
  expect(screen.getAllByText('new@example.com')).toHaveLength(1);
  expect(refresh).not.toHaveBeenCalled();
});

test('pending and expired labels use the supplied server instant, including expiry equality', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2040-01-01T00:00:00Z'));
  const view = setup();
  const row = screen.getByText('new@example.com').closest('li');
  expect(within(row).getByText('Pendente')).toBeTruthy();
  expect(within(row).getByText(/7 de novembro de 2026/)).toBeTruthy();
  expect(row.querySelector('time').getAttribute('dateTime')).toBe('2026-11-07T12:00:00Z');
  view.rerender(manager({ now: INVITATION.expiresAt }));
  expect(within(row).getByText('Expirado')).toBeTruthy();
  expect(within(row).queryByText('Pendente')).toBeNull();
  expect(within(row).queryByRole('button', { name: /Revogar convite/ })).toBeNull();
});

test('confirmation warns that the link stops working and cancellation never deletes', async () => {
  setup();
  const dialog = openRevoke();
  expect(within(dialog).getByText(/link do convite deixará de funcionar/)).toBeTruthy();
  expect(revokeInvitation).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' })); });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(revokeInvitation).not.toHaveBeenCalled();
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
});

test('a failed revoke keeps the invitation visible and shows no success', async () => {
  revokeInvitation.mockResolvedValueOnce({ ok: false, status: 503, detail: 'Tente novamente.', errors: {} });
  setup();
  const dialog = openRevoke();
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Revogar convite' })); });
  expect(revokeInvitation).toHaveBeenCalledExactlyOnceWith(INVITATION.id);
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Tente novamente.');
  expect(screen.queryByText('Convite revogado.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

test('successful revoke waits for DELETE and leaves collection ownership with refreshed props', async () => {
  let release;
  revokeInvitation.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const view = setup();
  const dialog = openRevoke();
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Revogar convite' })); });
  expect(screen.getByRole('button', { name: 'Revogar convite para new@example.com' }).disabled).toBe(true);
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(screen.queryByText('Convite revogado.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { release({ ok: true, data: undefined }); });
  expect(screen.getByText('Convite revogado.')).toBeTruthy();
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(refresh).toHaveBeenCalledOnce();
  view.rerender(manager({ invitations: [] }));
  expect(screen.queryByText('new@example.com')).toBeNull();
});
