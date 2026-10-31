import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import useDemoForm from './useDemoForm';
import { TextInput } from '../ui/Fields';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const SERVER_DELAY_MS = 650;
const event = { preventDefault: () => {} };
const rules = { nome: { required: true } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('a valid submission calls onSuccess with the values after the simulated delay', () => {
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useDemoForm({ initial: { nome: 'Ana' }, rules, onSuccess }));

  act(() => result.current.submit(event));
  expect(result.current.busy).toBe(true);
  expect(onSuccess).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));
  expect(result.current.busy).toBe(false);
  expect(onSuccess).toHaveBeenCalledWith({ nome: 'Ana' }, expect.anything());
});

test('an invalid submission shows the errors and never calls onSuccess', () => {
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useDemoForm({ initial: { nome: '' }, rules, onSuccess }));

  act(() => result.current.submit(event));
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));

  expect(result.current.errors).toEqual({ nome: 'Preencha este campo.' });
  expect(result.current.busy).toBe(false);
  expect(onSuccess).not.toHaveBeenCalled();
});

test('an invalid submission focuses the first invalid field and shows its message', () => {
  function Form() {
    const f = useDemoForm({ initial: { nome: 'Ana' }, rules: { nome: { required: true }, email: { required: true } } });
    return (
      <form onSubmit={f.submit} noValidate>
        <TextInput label="Nome" {...f.field('nome')} />
        <TextInput label="E-mail" {...f.field('email')} />
        <button type="submit">Salvar</button>
      </form>
    );
  }
  render(<Form />);

  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  const email = screen.getByLabelText('E-mail');
  expect(document.activeElement).toBe(email);
  expect(email.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Preencha este campo.')).toBeTruthy();
});

test('leaving the form before the simulated delay ends cancels the success callback', () => {
  const onSuccess = vi.fn((values, { go }) => go('/clientes/sergio-hooper', 'Cliente cadastrado.'));
  const { result, unmount } = renderHook(() => useDemoForm({ initial: { nome: 'Ana' }, rules, onSuccess }));

  act(() => result.current.submit(event));
  unmount();
  act(() => vi.advanceTimersByTime(SERVER_DELAY_MS));

  expect(onSuccess).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});
