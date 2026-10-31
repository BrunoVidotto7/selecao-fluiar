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

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
};

test('saving only the profile does not require the password fields', () => {
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
