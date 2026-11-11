import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ProductClientNotesEditor from './ProductClientNotesEditor';
import { FeedbackProvider } from '../feedback/Feedback';
import { CLIENT_PRODUCT } from '@/test-support/fixtures';
vi.mock('next/navigation', async (original) => ({ ...(await original()), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const save = vi.fn();
const props = { productId: CLIENT_PRODUCT.id, productName: CLIENT_PRODUCT.name, clientId: 'c1', clientNotes: null, onSave: save };
const view = (extra = {}) => <FeedbackProvider><ProductClientNotesEditor {...props} {...extra} /></FeedbackProvider>;
const input = () => screen.getByRole('textbox', { name: `Observação: ${CLIENT_PRODUCT.name}` });
const submit = () => fireEvent.click(screen.getByRole('button', { name: `Salvar observação de ${CLIENT_PRODUCT.name}` }));
beforeEach(() => { save.mockReset().mockResolvedValue({ ok: true, data: { clientNotes: [{ clientId: 'c1', clientName: 'Mariana', text: 'Bought locally' }] } }); });

test('notes save explicitly and normalize the submitted text', async () => {
  render(view());
  fireEvent.change(input(), { target: { value: '  Bought locally  ' } });
  await act(async () => submit());
  expect(save).toHaveBeenCalledExactlyOnceWith('Bought locally');
  expect(input().value).toBe('Bought locally');
});
test('a dirty note survives server props from an unrelated purchase refresh', () => {
  const rendered = render(view());
  fireEvent.change(input(), { target: { value: 'My draft' } });
  rendered.rerender(view({ clientNotes: 'Remote saved note' }));
  expect(input().value).toBe('My draft');
});
test('failed saves retain the draft and display safe feedback', async () => {
  save.mockResolvedValue({ ok: false, status: 503, detail: 'Tente novamente.', errors: {} });
  render(view());
  fireEvent.change(input(), { target: { value: 'My draft' } });
  await act(async () => submit());
  expect(input().value).toBe('My draft');
  expect(screen.getByRole('status').textContent).toContain('Tente novamente.');
});
test('oversized notes are rejected before the action and blank notes clear saved text', async () => {
  render(view({ clientNotes: 'Saved note' }));
  fireEvent.change(input(), { target: { value: 'a'.repeat(1001) } });
  await act(async () => submit());
  expect(save).not.toHaveBeenCalled();
  expect(input().getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(input(), { target: { value: '  ' } });
  save.mockResolvedValue({ ok: true, data: { clientNotes: [] } });
  await act(async () => submit());
  expect(save).toHaveBeenCalledExactlyOnceWith(null);
  expect(input().value).toBe('');
});
test('late results preserve newer typing and duplicate submits are blocked', async () => {
  let release;
  save.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  render(view());
  fireEvent.change(input(), { target: { value: 'First draft' } });
  submit(); submit();
  expect(save).toHaveBeenCalledOnce();
  fireEvent.change(input(), { target: { value: 'Newer draft' } });
  await act(async () => release({ ok: true, data: { clientNotes: [{ clientId: 'c1', clientName: 'Mariana', text: 'First draft' }] } }));
  expect(input().value).toBe('Newer draft');
});
