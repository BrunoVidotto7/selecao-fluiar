import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import OfficeManager from './OfficeManager';
import { renameOffice } from './actions';
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
const deferred = () => {
  let resolve;
  const promise = new Promise((release) => { resolve = release; });
  return { promise, resolve };
};
const rename = (name) => fireEvent.change(screen.getByLabelText('Nome do escritório'), { target: { value: name } });
const submitRename = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar escritório' })); });
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  renameOffice.mockReset().mockResolvedValue({ ok: true, data: { ...OFFICE, name: 'Ateliê Ana' } });
});
afterEach(() => { vi.useRealTimers(); });

function manager(props = {}) {
  return <FeedbackProvider><OfficeManager office={OFFICE} invitations={[INVITATION]} now={NOW} {...props} /></FeedbackProvider>;
}

function setup(props) {
  const view = render(manager(props));
  expect(screen.queryByLabelText('Nome do escritório')).toBeTruthy();
  expect(screen.queryByLabelText('E-mail do convite')).toBeNull();
  return view;
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
  expect(screen.getByRole('button', { name: 'Salvando…' }).disabled).toBe(true);
  expect(screen.queryByText('Escritório salvo.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { release({ ok: true, data: { ...OFFICE, name: 'Ateliê Ana' } }); });
  expect(screen.getByText('Escritório salvo.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Salvar escritório' }).disabled).toBe(false);
  expect(refresh).toHaveBeenCalledOnce();
});

test.each(['before', 'after'])('newer office input survives same-UUID refresh %s the pending save settles', async (order) => {
  const pending = deferred();
  renameOffice.mockReturnValueOnce(pending.promise);
  const view = setup();
  rename('Ateliê Ana');
  await submitRename();
  const input = screen.getByLabelText('Nome do escritório');
  expect(input.disabled).toBe(false);
  rename('Próximo nome');
  const savedOffice = { ...OFFICE, name: 'Ateliê Ana' };
  if (order === 'before') view.rerender(manager({ office: savedOffice }));
  await act(async () => { pending.resolve({ ok: true, data: savedOffice }); });
  if (order === 'after') view.rerender(manager({ office: savedOffice }));

  expect(screen.getByLabelText('Nome do escritório').value).toBe('Próximo nome');
  expect(screen.getByRole('status').textContent).toContain('Escritório salvo.');
  expect(refresh).toHaveBeenCalledOnce();
  await submitRename();
  expect(renameOffice).toHaveBeenLastCalledWith({ name: 'Próximo nome' });
});

test('editing back to the original name during a save survives its early prop refresh', async () => {
  const pending = deferred();
  renameOffice.mockReturnValueOnce(pending.promise);
  const view = setup();
  rename('Ateliê Ana');
  await submitRename();
  rename('Escritório de Ana Lima');
  const savedOffice = { ...OFFICE, name: 'Ateliê Ana' };
  view.rerender(manager({ office: savedOffice }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Escritório de Ana Lima');
  expect(screen.getByRole('button', { name: 'Salvando…' }).disabled).toBe(true);

  await act(async () => { pending.resolve({ ok: true, data: savedOffice }); });
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Escritório de Ana Lima');
  await submitRename();
  expect(renameOffice).toHaveBeenLastCalledWith({ name: 'Escritório de Ana Lima' });
});

test('another member rename preserves a dirty office draft but updates its clean baseline', () => {
  const view = setup();
  rename('Meu rascunho');
  view.rerender(manager({ office: { ...OFFICE, name: 'Nome de outro membro' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Meu rascunho');

  rename('Nome de outro membro');
  view.rerender(manager({ office: { ...OFFICE, name: 'Novo nome confirmado' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Novo nome confirmado');
});

test('success adopts the normalized submitted name without reverting to stale props before acknowledgment', async () => {
  const view = setup();
  rename('  Ateliê Ana  ');
  await submitRename();
  expect(renameOffice).toHaveBeenCalledExactlyOnceWith({ name: '  Ateliê Ana  ' });
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Ateliê Ana');

  view.rerender(manager({ invitations: [] }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Ateliê Ana');
  view.rerender(manager({ office: { ...OFFICE, name: 'Ateliê Ana' } }));
  view.rerender(manager({ office: { ...OFFICE, name: 'Nome externo confirmado' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Nome externo confirmado');
});

test.each([false, true])('a new external office name reconciles the saved baseline before acknowledgment with dirty draft %s', async (dirty) => {
  const view = setup();
  rename('Ateliê Ana');
  await submitRename();
  if (dirty) rename('Meu rascunho');
  view.rerender(manager({ office: { ...OFFICE, name: 'Nome de outro membro' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe(dirty ? 'Meu rascunho' : 'Nome de outro membro');

  rename('Nome de outro membro');
  view.rerender(manager({ office: { ...OFFICE, name: 'Novo nome externo' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Novo nome externo');
});

test('an older save acknowledgment cannot roll back the latest saved name or a newer draft', async () => {
  const view = setup();
  rename('Ateliê Ana');
  await submitRename();
  const pending = deferred();
  renameOffice.mockReturnValueOnce(pending.promise);
  rename('Segundo nome');
  await submitRename();
  await act(async () => { pending.resolve({ ok: true, data: { ...OFFICE, name: 'Segundo nome' } }); });
  view.rerender(manager({ office: { ...OFFICE, name: 'Ateliê Ana' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Segundo nome');

  rename('Terceiro rascunho');
  view.rerender(manager({ office: { ...OFFICE, name: 'Segundo nome' } }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Terceiro rascunho');
});

test.each(['success', 'failure'])('a fresh office UUID resets ownership and ignores the former pending %s', async (outcome) => {
  const pending = deferred();
  renameOffice.mockReturnValueOnce(pending.promise);
  const view = setup();
  rename('Rascunho do escritório anterior');
  await submitRename();
  const otherOffice = { ...OFFICE, id: '77777777-7777-4777-8777-777777775555' };
  view.rerender(manager({ office: otherOffice }));
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Escritório de Ana Lima');
  expect(screen.getByRole('button', { name: 'Salvar escritório' }).disabled).toBe(false);

  await act(async () => { pending.resolve(outcome === 'success'
    ? { ok: true, data: { ...OFFICE, name: 'Rascunho do escritório anterior' } }
    : { ok: false, status: 503, detail: 'Tente novamente.', errors: {} }); });
  expect(screen.getByLabelText('Nome do escritório').value).toBe('Escritório de Ana Lima');
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});

test('a failed pending office save retains later input through an external rename without success refresh', async () => {
  const pending = deferred();
  renameOffice.mockReturnValueOnce(pending.promise);
  const view = setup();
  rename('Ateliê Ana');
  await submitRename();
  rename('Próximo nome');
  await act(async () => { pending.resolve({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { name: 'Use no máximo 120 caracteres.' },
  }); });
  view.rerender(manager({ office: { ...OFFICE, name: 'Nome de outro membro' } }));
  const input = screen.getByLabelText('Nome do escritório');
  expect(input.value).toBe('Próximo nome');
  expect(input.getAttribute('aria-invalid')).toBe('false');
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(screen.queryByText('Escritório salvo.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
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

test('upstream name errors map only to officeName and keep the exact detail', async () => {
  renameOffice.mockResolvedValueOnce({ ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { name: 'Use no máximo 120 caracteres.' } });
  setup();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar escritório' })); });
  const input = screen.getByLabelText('Nome do escritório');
  expect(input.id).toBe('officeName');
  expect(input.getAttribute('aria-describedby')).toBe('officeName-err');
  expect(document.getElementById('officeName-err').textContent).toBe('Use no máximo 120 caracteres.');
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(screen.queryByLabelText('E-mail do convite')).toBeNull();
  expect(screen.queryByText('Escritório salvo.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});
