import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import SettingsForm from './SettingsForm';
import { FeedbackProvider } from '../feedback/Feedback';
import { ME } from '@/test-support/fixtures';

const { updateProfile, changePassword, refresh } = vi.hoisted(() => ({
  updateProfile: vi.fn(), changePassword: vi.fn(), refresh: vi.fn(),
}));
vi.mock('./actions', () => ({ updateProfile, changePassword }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => '/configuracoes',
  unstable_rethrow: (error) => { if (error.message.startsWith('NEXT_')) throw error; },
}));

const SAVED_USER = { ...ME, name: 'Ana Reis', email: 'new@example.com' };
const WRONG_PASSWORD = {
  ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { currentPassword: 'Senha atual incorreta.' },
};
const RATE_LIMIT = {
  ok: false, status: 429, detail: 'Muitas tentativas. Tente novamente em alguns minutos.', errors: {},
};
const tree = (user = ME) => <FeedbackProvider><SettingsForm user={user} /></FeedbackProvider>;
const type = (label, value, options) => fireEvent.change(screen.getByLabelText(label, options), { target: { value } });
const profileForm = () => screen.getByLabelText('E-mail').closest('form');
const passwordForm = () => screen.getByLabelText('Nova senha').closest('form');
const submit = async (form) => { await act(async () => { fireEvent.submit(form); }); };
const expectFieldError = (input, message) => {
  expect(input.getAttribute('aria-describedby')).toBe(input.id + '-err');
  expect(document.getElementById(input.id + '-err').textContent).toBe(message);
};
const fillPassword = (password = 'newPassword123') => {
  type('Senha atual', 'oldPassword', { selector: '#currentPassword' });
  type('Nova senha', password);
  type('Confirme a nova senha', password);
};
const deferred = () => {
  let resolve;
  const promise = new Promise((release) => { resolve = release; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  updateProfile.mockReset().mockResolvedValue({ ok: true, data: SAVED_USER });
  changePassword.mockReset().mockResolvedValue({ ok: true, data: ME });
});

test('profile and password have independent accessible forms and save buttons', () => {
  render(tree());
  expect(screen.queryByRole('button', { name: 'Salvar perfil' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Alterar senha' })).toBeTruthy();
  expect(profileForm()).not.toBe(passwordForm());
  expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull();
  expect(screen.getByLabelText('Nome completo').id).toBe('name');
  expect(screen.getByLabelText('E-mail').id).toBe('email');
  expect(screen.getByLabelText('Senha atual').id).toBe('currentPassword');
  expect(screen.getByLabelText('Nova senha').id).toBe('newPassword');
  expect(screen.getByLabelText('Confirme a nova senha').id).toBe('confirmNewPassword');
});

test('changing email requires the current password only for the profile request', async () => {
  render(tree());
  type('E-mail', SAVED_USER.email);
  await submit(profileForm());
  expectFieldError(screen.getByLabelText('Senha atual', { selector: '#emailPassword' }), 'Informe a senha atual para trocar o e-mail.');
  expect(updateProfile).not.toHaveBeenCalled();
  type('Senha atual', 'oldPassword', { selector: '#emailPassword' });
  await submit(profileForm());
  expect(updateProfile).toHaveBeenCalledExactlyOnceWith({
    name: ME.name, email: 'new@example.com', currentPassword: 'oldPassword',
  });
  expect(changePassword).not.toHaveBeenCalled();
  expect(screen.getByText('Perfil salvo.')).toBeTruthy();
  expect(screen.getByLabelText('Nome completo').value).toBe('Ana Reis');
  expect(screen.queryByLabelText('Senha atual', { selector: '#emailPassword' })).toBeNull();
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([
  ['ana@example.com', 'ana@example.com'],
  [' ANA@EXAMPLE.COM ', 'ANA@EXAMPLE.COM'],
])('name-only and normalized unchanged email %j omit password confirmation', async (email, sentEmail) => {
  updateProfile.mockResolvedValue({ ok: true, data: { ...ME, name: 'Ana Reis' } });
  render(tree());
  type('Nome completo', 'Ana Reis');
  type('E-mail', email);
  fillPassword();
  expect(screen.queryByLabelText('Senha atual', { selector: '#emailPassword' })).toBeNull();
  await submit(profileForm());
  expect(updateProfile).toHaveBeenCalledExactlyOnceWith({ name: 'Ana Reis', email: sentEmail });
  expect(changePassword).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Nova senha').value).toBe('newPassword123');
});

test.each([WRONG_PASSWORD, RATE_LIMIT])('profile failure %j retains its own edits and does not touch the independent password draft', async (failure) => {
  updateProfile.mockResolvedValue(failure);
  render(tree());
  type('Nome completo', 'Ana Reis');
  type('E-mail', 'new@example.com');
  type('Senha atual', 'wrongPassword', { selector: '#emailPassword' });
  fillPassword();
  await submit(profileForm());
  expect(updateProfile).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Nome completo').value).toBe('Ana Reis');
  expect(screen.getByLabelText('E-mail').value).toBe('new@example.com');
  expect(screen.getByLabelText('Senha atual', { selector: '#emailPassword' }).value).toBe('wrongPassword');
  expect(screen.getByLabelText('Nova senha').value).toBe('newPassword123');
  expect(screen.getByRole('status').textContent).toContain(failure.detail);
  if (failure.errors.currentPassword) {
    expectFieldError(screen.getByLabelText('Senha atual', { selector: '#emailPassword' }), 'Senha atual incorreta.');
    expect(screen.getByLabelText('Senha atual', { selector: '#currentPassword' }).getAttribute('aria-invalid')).not.toBe('true');
  }
  expect(changePassword).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test('password success clears only password fields after awaiting the action', async () => {
  const pending = deferred();
  changePassword.mockReturnValue(pending.promise);
  render(tree());
  type('Nome completo', 'Rascunho do perfil');
  fillPassword(' newPassword123 ');
  await submit(passwordForm());
  expect(changePassword).toHaveBeenCalledExactlyOnceWith({ currentPassword: 'oldPassword', newPassword: ' newPassword123 ' });
  expect(screen.getByLabelText('Nova senha').value).toBe(' newPassword123 ');
  expect(screen.getByRole('button', { name: 'Alterando…' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Salvar perfil' }).disabled).toBe(false);
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { pending.resolve({ ok: true, data: ME }); });
  for (const label of ['Senha atual', 'Nova senha', 'Confirme a nova senha']) {
    expect(screen.getByLabelText(label).value).toBe('');
  }
  expect(screen.getByLabelText('Nome completo').value).toBe('Rascunho do perfil');
  expect(screen.getByText('Senha alterada.')).toBeTruthy();
  expect(updateProfile).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([WRONG_PASSWORD, RATE_LIMIT])('saved profile survives a separate password failure %j and refreshed identity props', async (failure) => {
  changePassword.mockResolvedValue(failure);
  const view = render(tree());
  type('Nome completo', 'Ana Reis');
  type('E-mail', 'new@example.com');
  type('Senha atual', 'oldPassword', { selector: '#emailPassword' });
  fillPassword();
  await submit(profileForm());
  expect(screen.getByText('Perfil salvo.')).toBeTruthy();
  expect(screen.getByLabelText('Nome completo').value).toBe('Ana Reis');
  await submit(passwordForm());
  expect(changePassword).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain(failure.detail);
  view.rerender(tree(SAVED_USER));
  expect(screen.getByLabelText('Nome completo').value).toBe('Ana Reis');
  expect(screen.getByLabelText('E-mail').value).toBe('new@example.com');
  expect(screen.queryByLabelText('Senha atual', { selector: '#emailPassword' })).toBeNull();
  expect(screen.getByLabelText('Senha atual', { selector: '#currentPassword' }).value).toBe('oldPassword');
  expect(screen.getByLabelText('Nova senha').value).toBe('newPassword123');
  expect(screen.getByLabelText('Confirme a nova senha').value).toBe('newPassword123');
  if (failure.errors.currentPassword) {
    expectFieldError(screen.getByLabelText('Senha atual', { selector: '#currentPassword' }), 'Senha atual incorreta.');
    expect(within(profileForm()).queryByText('Senha atual incorreta.')).toBeNull();
  }
  await submit(profileForm());
  expect(updateProfile).toHaveBeenLastCalledWith({ name: 'Ana Reis', email: 'new@example.com' });
});

test('password failure and profile success can settle independently without dropping failed password drafts', async () => {
  const profile = deferred();
  const password = deferred();
  updateProfile.mockReturnValue(profile.promise);
  changePassword.mockReturnValue(password.promise);
  render(tree());
  type('Nome completo', 'Ana Reis');
  fillPassword();
  await submit(profileForm());
  await submit(profileForm());
  expect(updateProfile).toHaveBeenCalledOnce();
  await submit(passwordForm());
  expect(changePassword).toHaveBeenCalledOnce();
  await act(async () => { password.resolve(WRONG_PASSWORD); });
  expectFieldError(screen.getByLabelText('Senha atual', { selector: '#currentPassword' }), 'Senha atual incorreta.');
  await act(async () => { profile.resolve({ ok: true, data: { ...ME, name: 'Ana Reis' } }); });
  expect(screen.getByLabelText('Nome completo').value).toBe('Ana Reis');
  expect(screen.getByLabelText('Nova senha').value).toBe('newPassword123');
  expectFieldError(screen.getByLabelText('Senha atual', { selector: '#currentPassword' }), 'Senha atual incorreta.');
});

test('a pending profile success updates the saved baseline without overwriting newer drafts on refresh', async () => {
  const pending = deferred();
  updateProfile.mockReturnValue(pending.promise);
  const view = render(tree());
  type('Nome completo', 'Ana Reis');
  type('E-mail', 'new@example.com');
  type('Senha atual', 'oldPassword', { selector: '#emailPassword' });
  await submit(profileForm());
  expect(updateProfile).toHaveBeenCalledExactlyOnceWith({
    name: 'Ana Reis', email: 'new@example.com', currentPassword: 'oldPassword',
  });
  type('Nome completo', 'Próximo nome');
  type('E-mail', 'next@example.com');
  type('Senha atual', 'anotherPassword', { selector: '#emailPassword' });
  await act(async () => { pending.resolve({ ok: true, data: SAVED_USER }); });
  view.rerender(tree(SAVED_USER));
  expect(screen.getByLabelText('Nome completo').value).toBe('Próximo nome');
  expect(screen.getByLabelText('E-mail').value).toBe('next@example.com');
  expect(screen.getByLabelText('Senha atual', { selector: '#emailPassword' }).value).toBe('anotherPassword');
  type('E-mail', 'NEW@EXAMPLE.COM');
  expect(screen.queryByLabelText('Senha atual', { selector: '#emailPassword' })).toBeNull();
});

test.each([
  ['short', 'short', 'Use entre 8 e 72 caracteres.'],
  ['non-ASCII bytes', 'á'.repeat(37), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
  ['raw whitespace bytes', ' ' + 'á'.repeat(36), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
])('new password validates %s using shared raw-password rules', async (_, password, message) => {
  render(tree());
  fillPassword(password);
  await submit(passwordForm());
  expectFieldError(screen.getByLabelText('Nova senha'), message);
  expect(changePassword).not.toHaveBeenCalled();
});

test.each([' abcdef ', 'á'.repeat(36)])('a valid raw password %j is sent unchanged at the character and byte boundaries', async (password) => {
  render(tree());
  fillPassword(password);
  await submit(passwordForm());
  expect(changePassword).toHaveBeenCalledExactlyOnceWith({ currentPassword: 'oldPassword', newPassword: password });
  expect(screen.getByText('Senha alterada.')).toBeTruthy();
});

test('password submission requires current password and a matching confirmation without blocking profile saving', async () => {
  render(tree());
  type('Nova senha', 'newPassword123');
  type('Confirme a nova senha', 'differentPassword');
  await submit(passwordForm());
  expectFieldError(screen.getByLabelText('Senha atual'), 'Informe a senha atual para trocar a senha.');
  expectFieldError(screen.getByLabelText('Confirme a nova senha'), 'As senhas não são iguais.');
  expect(changePassword).not.toHaveBeenCalled();
  await submit(profileForm());
  expect(updateProfile).toHaveBeenCalledExactlyOnceWith({ name: ME.name, email: ME.email });
});

test('profile field errors map name and email without clearing drafts', async () => {
  updateProfile.mockResolvedValue({
    ok: false, status: 400, detail: 'Revise os campos destacados.',
    errors: { name: 'Use no máximo 120 caracteres.', email: 'Este e-mail já tem uma conta.' },
  });
  render(tree());
  type('Nome completo', 'Ana Reis');
  await submit(profileForm());
  expectFieldError(screen.getByLabelText('Nome completo'), 'Use no máximo 120 caracteres.');
  expectFieldError(screen.getByLabelText('E-mail'), 'Este e-mail já tem uma conta.');
  expect(screen.getByLabelText('Nome completo').value).toBe('Ana Reis');
});

test('upstream newPassword error maps to nova, not the confirmation', async () => {
  changePassword.mockResolvedValue({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { newPassword: 'Use entre 8 e 72 caracteres.' },
  });
  render(tree());
  fillPassword();
  await submit(passwordForm());
  expectFieldError(screen.getByLabelText('Nova senha'), 'Use entre 8 e 72 caracteres.');
  expect(screen.getByLabelText('Confirme a nova senha').getAttribute('aria-invalid')).not.toBe('true');
});
