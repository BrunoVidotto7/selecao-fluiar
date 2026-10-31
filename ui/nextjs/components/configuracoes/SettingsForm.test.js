import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SettingsForm from './SettingsForm';
import { FeedbackProvider } from '../feedback/Feedback';
import { USER } from '@/lib/data';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/configuracoes' }));

const SERVER_DELAY_MS = 650;
const SAVED = 'Alterações salvas.';

beforeEach(() => {
  vi.useFakeTimers();
  render(<FeedbackProvider><SettingsForm user={USER} /></FeedbackProvider>);
});
afterEach(() => vi.useRealTimers());

const type = (label, value, options) => fireEvent.change(screen.getByLabelText(label, options), { target: { value } });
const save = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
};

test('saving only the profile does not require the password fields', () => {
  save();
  expect(screen.getByText(SAVED)).toBeTruthy();
});

test('a new e-mail asks for the current password', () => {
  expect(screen.queryByLabelText('Senha atual', { selector: '#senhaEmail' })).toBeNull();

  type('E-mail', 'paula.nova@fluiar.com.br');
  expect(screen.getByLabelText('Senha atual', { selector: '#senhaEmail' })).toBeTruthy();

  save();
  expect(screen.getByText('Informe a senha atual para trocar o e-mail.')).toBeTruthy();
  expect(screen.queryByText(SAVED)).toBeNull();

  type('Senha atual', 'antiga', { selector: '#senhaEmail' });
  save();
  expect(screen.getByText(SAVED)).toBeTruthy();
});

test('an e-mail that only changes case does not ask for the password', () => {
  type('E-mail', 'PAULA.HOOPER@FLUIAR.COM.BR');

  expect(screen.queryByLabelText('Senha atual', { selector: '#senhaEmail' })).toBeNull();
  save();
  expect(screen.getByText(SAVED)).toBeTruthy();
});

test('a new password requires the current password', () => {
  type('Nova senha', 'Senha1234');
  type('Confirme a nova senha', 'Senha1234');
  save();
  expect(screen.getByText('Informe a senha atual para trocar a senha.')).toBeTruthy();
  expect(screen.queryByText(SAVED)).toBeNull();

  type('Senha atual', 'antiga');
  save();
  expect(screen.getByText(SAVED)).toBeTruthy();
});
