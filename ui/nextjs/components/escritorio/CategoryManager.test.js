import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import CategoryManager from './CategoryManager';
import { createCategory, deleteCategory, renameCategory } from './actions';
import { FeedbackProvider } from '../feedback/Feedback';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/escritorio',
  unstable_rethrow: vi.fn(),
}));
vi.mock('./actions', () => ({
  createCategory: vi.fn(), renameCategory: vi.fn(), deleteCategory: vi.fn(),
  inviteMember: vi.fn(), renameOffice: vi.fn(), revokeInvitation: vi.fn(),
}));

const PEDRAS = '11111111-1111-4111-8111-111111111111';
const PAISAGISMO = '22222222-2222-4222-8222-222222222222';
const CATEGORIES = [
  { id: PEDRAS, name: 'Pedras', productCount: 12 },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Tecidos', productCount: 1 },
  { id: PAISAGISMO, name: 'Paisagismo', productCount: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  createCategory.mockReset().mockResolvedValue({ ok: true, data: {} });
  renameCategory.mockReset().mockResolvedValue({ ok: true, data: {} });
  deleteCategory.mockReset().mockResolvedValue({ ok: true, data: null });
});

const view = () => render(<FeedbackProvider><CategoryManager categories={CATEGORIES} /></FeedbackProvider>);
const click = async (name) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); }); };

test('renders categories in the given order with product counts', () => {
  view();
  expect(screen.getByRole('heading', { name: 'Categorias' })).toBeTruthy();
  const rows = screen.getAllByRole('listitem');
  expect(rows.map((row) => within(row).getByText(/^(Pedras|Tecidos|Paisagismo)$/).textContent)).toEqual(['Pedras', 'Tecidos', 'Paisagismo']);
  expect(within(rows[0]).getByText('12 produtos')).toBeTruthy();
  expect(within(rows[1]).getByText('1 produto')).toBeTruthy();
  expect(within(rows[2]).queryByText(/produto/)).toBeNull();
});

test('adds a category', async () => {
  view();
  fireEvent.change(screen.getByLabelText('Nova categoria'), { target: { value: 'Paisagismo' } });
  await click('Adicionar');
  expect(createCategory).toHaveBeenCalledWith({ name: 'Paisagismo' });
  expect(screen.getByText('Categoria adicionada.')).toBeTruthy();
  expect(refresh).toHaveBeenCalled();
});

test('shows field error from API', async () => {
  createCategory.mockResolvedValue({ ok: false, status: 409, detail: 'Conflito.', errors: { name: 'Já existe uma categoria com esse nome.' } });
  view();
  fireEvent.change(screen.getByLabelText('Nova categoria'), { target: { value: 'Pedras' } });
  await click('Adicionar');
  expect(screen.getByText('Já existe uma categoria com esse nome.')).toBeTruthy();
});

test('validates locally', async () => {
  view();
  await click('Adicionar');
  expect(screen.getByText('Informe o nome da categoria.')).toBeTruthy();
  expect(createCategory).not.toHaveBeenCalled();
});

test('rejects names over 60 characters locally', async () => {
  view();
  fireEvent.change(screen.getByLabelText('Nova categoria'), { target: { value: 'a'.repeat(61) } });
  await click('Adicionar');
  expect(screen.getByText('Use até 60 caracteres.')).toBeTruthy();
  expect(createCategory).not.toHaveBeenCalled();
});

test('renames inline', async () => {
  view();
  await click('Renomear Pedras');
  const input = screen.getByLabelText('Nome da categoria');
  expect(input.value).toBe('Pedras');
  fireEvent.change(input, { target: { value: 'Pedras naturais' } });
  await click('Salvar');
  expect(renameCategory).toHaveBeenCalledWith(PEDRAS, { name: 'Pedras naturais' });
  expect(screen.getByText('Categoria renomeada.')).toBeTruthy();
  expect(refresh).toHaveBeenCalled();
});

test('cancel restores the row', async () => {
  view();
  await click('Renomear Pedras');
  fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'Outra' } });
  await click('Cancelar');
  expect(screen.queryByLabelText('Nome da categoria')).toBeNull();
  expect(screen.getByText('Pedras')).toBeTruthy();
  expect(renameCategory).not.toHaveBeenCalled();
});

test('confirms delete with product count', async () => {
  view();
  await click('Apagar Pedras');
  expect(screen.getByText('Apagar a categoria Pedras? 12 produtos continuam com ela, mas ela some dos filtros.')).toBeTruthy();
  await click('Apagar categoria');
  expect(deleteCategory).toHaveBeenCalledWith(PEDRAS);
  expect(screen.getByText('Categoria apagada.')).toBeTruthy();
  expect(refresh).toHaveBeenCalled();
});

test('delete confirmation is short when the category has no products', async () => {
  view();
  await click('Apagar Paisagismo');
  expect(screen.getByText('Apagar a categoria Paisagismo?', { selector: 'p' })).toBeTruthy();
});

test('with a rename open, the new category label still points at the add input and ids are unique', async () => {
  const { container } = view();
  await click('Renomear Pedras');
  const add = screen.getByLabelText('Nova categoria');
  const rename = screen.getByLabelText('Nome da categoria');
  expect(add).not.toBe(rename);
  const ids = Array.from(container.querySelectorAll('[id]'), (el) => el.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('an API field error in a rename row is tied to that row input', async () => {
  renameCategory.mockResolvedValue({ ok: false, status: 409, detail: 'Conflito.', errors: { name: 'Já existe uma categoria com esse nome.' } });
  view();
  await click('Renomear Pedras');
  fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'Tecidos' } });
  await click('Salvar');
  const input = screen.getByLabelText('Nome da categoria');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Já existe uma categoria com esse nome.');
  expect(screen.getByLabelText('Nova categoria').getAttribute('aria-invalid')).toBe('false');
});

test('delete confirmation uses the singular verb for one product', async () => {
  view();
  await click('Apagar Tecidos');
  expect(screen.getByText('Apagar a categoria Tecidos? 1 produto continua com ela, mas ela some dos filtros.')).toBeTruthy();
});
