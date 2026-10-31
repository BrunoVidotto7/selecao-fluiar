import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FeedbackProvider } from '../feedback/Feedback';
import { ClientDetail, ClientForm, ClientsTable, useDeleteClient } from './Clientes';
import { CLIENT, DASHBOARD, ME } from '@/test-support/fixtures';

const { push, refresh, saveClient, deleteClient, deleteList } = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), saveClient: vi.fn(), deleteClient: vi.fn(), deleteList: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }), usePathname: () => '/clientes',
  unstable_rethrow: (error) => { if (error.message === 'NEXT_REDIRECT') throw error; },
}));
vi.mock('./actions', () => ({ saveClient, deleteClient }));
vi.mock('../listas/actions', () => ({ deleteList, saveList: vi.fn() }));

const CLIENTS = [
  DASHBOARD.recentClients[0],
  { ...DASHBOARD.recentClients[0], id: '11111111-1111-4111-8111-111111115555', name: 'Sérgio Hooper', listCount: 0 },
];
const SUCCESS = { ok: true, data: undefined };
const FAILURE = { ok: false, status: 503, detail: 'Tente novamente.', errors: {} };
const wrapper = (children) => <FeedbackProvider>{children}</FeedbackProvider>;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const fill = () => {
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Ana Lima' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ME.email } });
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(31) 99999-8888' } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }));
const confirmDelete = (label) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir cliente' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  saveClient.mockReset().mockResolvedValue({ ok: true, data: CLIENT });
  deleteClient.mockReset().mockResolvedValue(SUCCESS);
  deleteList.mockReset().mockResolvedValue(SUCCESS);
});
afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });

test('the client form validates required name, e-mail and DDD before persistence', () => {
  render(wrapper(<ClientForm />));
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@' } });
  submit();
  expect(screen.getAllByText('Preencha este campo.')).toHaveLength(2);
  expect(screen.getByText('Digite um e-mail válido, como nome@email.com.')).toBeTruthy();
  expect(saveClient).not.toHaveBeenCalled();

  fill();
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '123' } });
  submit();
  expect(screen.getByText('Digite o telefone com DDD, como (31) 99999-9999.')).toBeTruthy();
  expect(saveClient).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('a masked phone is sent as digits and the created UUID selects the route', async () => {
  render(wrapper(<ClientForm />));
  fill();
  submit();
  await waitFor(() => expect(push).toHaveBeenCalledWith('/clientes/' + CLIENT.id));
  expect(saveClient).toHaveBeenCalledExactlyOnceWith(null, { name: 'Ana Lima', email: ME.email, phone: '31999998888' });
  expect(refresh).toHaveBeenCalledOnce();
});

test('editing uses the persisted client and returned UUID while rendering its masked phone', async () => {
  render(wrapper(<ClientForm client={CLIENT} />));
  expect(screen.getByLabelText('Telefone').value).toBe('(31) 99999-8888');
  submit();
  await waitFor(() => expect(push).toHaveBeenCalledWith('/clientes/' + CLIENT.id));
  expect(saveClient).toHaveBeenCalledWith(CLIENT.id, { name: CLIENT.name, email: CLIENT.email, phone: CLIENT.phone });
});

test('upstream field errors map back to Portuguese fields without success feedback', async () => {
  saveClient.mockResolvedValue({ ...FAILURE, status: 400, detail: 'Revise os campos destacados.',
    errors: { name: 'Use no máximo 120 caracteres.', email: 'Preencha este campo.', phone: 'Digite o telefone com DDD, como (31) 99999-9999.' } });
  render(wrapper(<ClientForm />));
  fill();
  submit();
  await waitFor(() => expect(screen.getByLabelText('Nome completo').getAttribute('aria-invalid')).toBe('true'));
  expect(screen.getByLabelText('E-mail').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('Telefone').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('pending client saves suppress duplicate submits and feedback after navigation', async () => {
  const pending = deferred();
  saveClient.mockReturnValue(pending.promise);
  const view = render(wrapper(<ClientForm />));
  fill();
  const form = screen.getByRole('button', { name: 'Salvar cliente' }).closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(saveClient).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Salvando…' }).disabled).toBe(true);
  view.rerender(wrapper(<p>Outra tela</p>));
  await act(async () => pending.resolve({ ok: true, data: CLIENT }));
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('client search ignores accents, shows no-results and remains applied after server-prop changes', () => {
  const view = render(<ClientsTable clients={CLIENTS} />);
  const search = screen.getByLabelText('Pesquisar clientes');
  fireEvent.change(search, { target: { value: 'sergio' } });
  expect(screen.getByRole('link', { name: 'Sérgio Hooper' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: CLIENT.name })).toBeNull();
  view.rerender(<ClientsTable clients={[CLIENTS[0], { ...CLIENTS[1], name: 'Sérgio atualizado' }]} />);
  expect(screen.getByRole('link', { name: 'Sérgio atualizado' })).toBeTruthy();
  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(screen.getByText(/Nenhum cliente encontrado/)).toBeTruthy();
});

test('cancelling client row deletion keeps the client and never writes', () => {
  render(wrapper(<ClientsTable clients={CLIENTS} />));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir ' + CLIENT.name }));
  expect(screen.getByText(`A lista de compras de ${CLIENT.name} também será excluída. Essa ação não pode ser desfeita.`)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('link', { name: CLIENT.name })).toBeTruthy();
  expect(deleteClient).not.toHaveBeenCalled();
});

test('failed client deletion keeps the client and its lists without success feedback', async () => {
  deleteClient.mockResolvedValue(FAILURE);
  render(wrapper(<ClientsTable clients={CLIENTS} />));
  confirmDelete('Excluir ' + CLIENT.name);
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Tente novamente.'));
  expect(screen.getByRole('link', { name: CLIENT.name })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir ' + CLIENT.name }));
  expect(screen.getByText(/A lista de compras/)).toBeTruthy();
  expect(screen.queryByText('Cliente excluído.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

test('successful row deletion waits for the API and only server props remove the row', async () => {
  const pending = deferred();
  deleteClient.mockReturnValue(pending.promise);
  const view = render(wrapper(<ClientsTable clients={CLIENTS} />));
  confirmDelete('Excluir ' + CLIENT.name);
  expect(deleteClient).toHaveBeenCalledWith(CLIENT.id);
  expect(screen.getByRole('link', { name: CLIENT.name })).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir ' + CLIENT.name }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(deleteClient).toHaveBeenCalledOnce();
  await act(async () => pending.resolve(SUCCESS));
  expect(screen.getByRole('link', { name: CLIENT.name })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Cliente excluído.');
  expect(refresh).toHaveBeenCalledOnce();
  view.rerender(wrapper(<ClientsTable clients={[]} />));
  expect(screen.getByText('Nenhum cliente por aqui ainda')).toBeTruthy();
});

test('last-list deletion derives count, empty state and cascade warning from refreshed client.lists', async () => {
  const pending = deferred();
  deleteList.mockReturnValue(pending.promise);
  const view = render(wrapper(<ClientDetail client={CLIENT}><h1>{CLIENT.name}</h1></ClientDetail>));
  expect(screen.getByRole('heading', { name: 'Listas de compras · 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  expect(screen.getByRole('heading', { name: 'Listas de compras · 1' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Casa nova' })).toBeTruthy();
  await act(async () => pending.resolve(SUCCESS));
  expect(screen.getByRole('heading', { name: 'Listas de compras · 1' })).toBeTruthy();
  view.rerender(wrapper(<ClientDetail client={{ ...CLIENT, lists: [] }}><h1>{CLIENT.name}</h1></ClientDetail>));
  expect(screen.getByRole('heading', { name: 'Listas de compras' })).toBeTruthy();
  expect(screen.getByText('Mariana ainda não tem listas')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Casa nova' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(screen.getByText('Essa ação não pode ser desfeita.')).toBeTruthy();
  expect(screen.queryByText(/também será excluída/)).toBeNull();
});

test.each([
  ['detail', () => <ClientDetail client={CLIENT} />, 'Excluir'],
  ['edit form', () => <ClientForm client={CLIENT} />, 'Excluir cliente'],
])('%s deletion waits for success before leaving the client route', async (_, element, label) => {
  const pending = deferred();
  deleteClient.mockReturnValue(pending.promise);
  render(wrapper(element()));
  confirmDelete(label);
  expect(deleteClient).toHaveBeenCalledWith(CLIENT.id);
  expect(push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
  await act(async () => pending.resolve(SUCCESS));
  expect(push).toHaveBeenCalledWith('/clientes');
  expect(refresh).toHaveBeenCalledOnce();
  expect(JSON.parse(sessionStorage.getItem('flash')).m).toBe('Cliente excluído.');
});

test.each([
  ['row success', () => <ClientsTable clients={CLIENTS} />, 'Excluir ' + CLIENT.name, SUCCESS],
  ['row failure', () => <ClientsTable clients={CLIENTS} />, 'Excluir ' + CLIENT.name, FAILURE],
  ['detail success', () => <ClientDetail client={CLIENT} />, 'Excluir', SUCCESS],
  ['detail failure', () => <ClientDetail client={CLIENT} />, 'Excluir', FAILURE],
  ['edit form success', () => <ClientForm client={CLIENT} />, 'Excluir cliente', SUCCESS],
  ['edit form failure', () => <ClientForm client={CLIENT} />, 'Excluir cliente', FAILURE],
])('%s pending delete cannot navigate or display feedback from an unmounted owner', async (_, element, label, result) => {
  const pending = deferred();
  deleteClient.mockReturnValue(pending.promise);
  const view = render(wrapper(element()));
  confirmDelete(label);
  expect(deleteClient).toHaveBeenCalledOnce();
  view.rerender(wrapper(<p>Outra tela</p>));
  await act(async () => pending.resolve(result));
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toBe('');
  expect(sessionStorage.getItem('flash')).toBeNull();
});

function DeleteHarness({ onDone }) {
  const del = useDeleteClient();
  return <button onClick={() => del(CLIENT, 1, onDone)}>Excluir de teste</button>;
}

test('the delete hook also guards owner lifetime while awaiting its completion callback', async () => {
  const callback = deferred();
  const done = vi.fn(() => callback.promise);
  const view = render(wrapper(<DeleteHarness onDone={done} />));
  confirmDelete('Excluir de teste');
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  view.rerender(wrapper(<p>Outra tela</p>));
  await act(async () => callback.resolve());
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});
