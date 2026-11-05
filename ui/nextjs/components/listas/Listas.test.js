import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import NewListPage from '@/app/(app)/(admin)/listas/nova/page';
import ListsPage from '@/app/(app)/(admin)/listas/page';
import DashboardPage from '@/app/(app)/(admin)/dashboard/page';
import EditListPage from '@/app/(app)/(admin)/listas/[id]/editar/page';
import { ListCards, ListForm, ListsTable } from './Listas';
import { FeedbackProvider } from '../feedback/Feedback';
import { CLIENT, DASHBOARD, LIST, ME } from '@/test-support/fixtures';

const { push, refresh, saveList, deleteList, fetchMock, cookies, revalidatePath, unstable_rethrow, pathname } = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), saveList: vi.fn(), deleteList: vi.fn(), fetchMock: vi.fn(), cookies: vi.fn(),
  revalidatePath: vi.fn(), unstable_rethrow: vi.fn(),
  pathname: { value: '/listas' },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }), usePathname: () => pathname.value, unstable_rethrow,
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('./actions', () => ({ saveList, deleteList }));

const SUMMARY = CLIENT.lists[0];
const EMPTY_LIST = {
  ...SUMMARY, id: '22222222-2222-4222-8222-222222225555', name: 'Sem produtos',
  totalProducts: 0, boughtProducts: 0, estimatedTotal: 0, completed: false,
};
const COMPLETED_LIST = {
  ...SUMMARY, id: '22222222-2222-4222-8222-222222226666', name: 'Café pronto',
  totalProducts: 1, boughtProducts: 1, completed: true,
};
const page = (Page, query = {}) => Page({ searchParams: Promise.resolve(query) });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
const feedback = (children) => <FeedbackProvider>{children}</FeedbackProvider>;
const json = (body) => new Response(JSON.stringify(body));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  pathname.value = '/listas';
  saveList.mockResolvedValue({ ok: true, data: LIST });
  deleteList.mockResolvedValue({ ok: true, data: undefined });
  cookies.mockResolvedValue({ get: () => ({ value: 'jwt' }) });
  fetchMock.mockReset().mockImplementation(async (url) => {
    if (url.endsWith('/api/clients')) return json(DASHBOARD.recentClients);
    if (url.endsWith('/api/lists')) return json([SUMMARY, EMPTY_LIST, COMPLETED_LIST]);
    return json(LIST);
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('the lists page displays server summaries and ignores prototype empty-state queries', async () => {
  render(await page(ListsPage, { estado: 'vazio' }));
  expect(screen.queryByRole('link', { name: 'Casa nova' })).not.toBeNull();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['http://localhost:8080/api/lists']);
});

test('list status uses completed and includes empty lists in progress; search combines with it', () => {
  render(<ListsTable lists={[SUMMARY, EMPTY_LIST, COMPLETED_LIST]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Em andamento' }));
  expect(screen.queryByRole('link', { name: 'Sem produtos' })).not.toBeNull();
  expect(screen.queryByRole('link', { name: 'Café pronto' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Concluídas' }));
  expect(screen.queryByRole('link', { name: 'Café pronto' })).not.toBeNull();
  expect(screen.queryByRole('link', { name: 'Sem produtos' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Pesquisar listas'), { target: { value: 'cafe' } });
  expect(screen.queryByRole('link', { name: 'Café pronto' })).not.toBeNull();
  fireEvent.change(screen.getByLabelText('Pesquisar listas'), { target: { value: 'casa' } });
  expect(screen.getByText(/Nenhuma lista encontrada/)).toBeTruthy();
});

test('refreshed server rows replace old rows while keeping the active search and status', () => {
  const view = render(<ListsTable lists={[SUMMARY]} />);
  fireEvent.change(screen.getByLabelText('Pesquisar listas'), { target: { value: 'casa' } });
  fireEvent.click(screen.getByRole('button', { name: 'Em andamento' }));
  view.rerender(<ListsTable lists={[{ ...SUMMARY, name: 'Casa reformada', boughtProducts: 1, completed: true }]} />);
  expect(screen.queryByRole('link', { name: 'Casa nova' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Casa reformada' })).toBeNull();
  expect(screen.getByLabelText('Pesquisar listas').value).toBe('casa');
  expect(screen.getByRole('button', { name: 'Em andamento' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Concluídas' }));
  expect(screen.queryByRole('link', { name: 'Casa reformada' })).not.toBeNull();
  view.rerender(<ListsTable lists={[]} />);
  expect(screen.getByText('Nenhuma lista criada')).toBeTruthy();
});

test('the form validates a name and a client before calling a server action', () => {
  render(feedback(<ListForm clients={DASHBOARD.recentClients} />));
  submit();
  expect(screen.getByText('Preencha este campo.')).toBeTruthy();
  expect(screen.getByText('Escolha o cliente desta lista.')).toBeTruthy();
  expect(saveList).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('the list form maps fields and uses the returned UUID', async () => {
  render(feedback(<ListForm clients={DASHBOARD.recentClients} />));
  fireEvent.change(screen.getByLabelText('Nome da lista'), { target: { value: 'Casa nova' } });
  fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: CLIENT.id } });
  submit();
  await waitFor(() => expect(saveList).toHaveBeenCalledExactlyOnceWith(null,
    { name: 'Casa nova', description: null, clientId: CLIENT.id }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/listas/' + LIST.id));
  expect(refresh).toHaveBeenCalledOnce();
});

test('edit saves English API fields and retains the persisted list ID', async () => {
  render(feedback(await EditListPage({ params: Promise.resolve({ id: LIST.id }) })));
  fireEvent.change(screen.getByLabelText('Descrição (opcional)'), { target: { value: 'Sala e cozinha.' } });
  submit();
  await waitFor(() => expect(saveList).toHaveBeenCalledExactlyOnceWith(LIST.id,
    { name: 'Casa nova', description: 'Sala e cozinha.', clientId: CLIENT.id }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/listas/' + LIST.id));
});

test('a deleted or foreign client error maps to the select, preserves edits and does not navigate', async () => {
  saveList.mockResolvedValue({
    ok: false, status: 400, detail: 'Revise os campos destacados.',
    errors: { clientId: 'Escolha o cliente desta lista.' },
  });
  render(feedback(<ListForm list={LIST} clients={DASHBOARD.recentClients} />));
  fireEvent.change(screen.getByLabelText('Nome da lista'), { target: { value: 'Minha casa' } });
  fireEvent.change(screen.getByLabelText('Descrição (opcional)'), { target: { value: 'Meu rascunho' } });
  submit();
  await waitFor(() => expect(screen.queryByText('Escolha o cliente desta lista.')).not.toBeNull());
  expect(screen.getByLabelText('Cliente').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(screen.getByLabelText('Cliente'));
  expect(screen.getByLabelText('Nome da lista').value).toBe('Minha casa');
  expect(screen.getByLabelText('Descrição (opcional)').value).toBe('Meu rascunho');
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test('a pending save is busy and duplicate submits never make a second request', async () => {
  let release;
  saveList.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  render(feedback(<ListForm list={LIST} clients={DASHBOARD.recentClients} />));
  const button = screen.getByRole('button', { name: 'Salvar lista' });
  fireEvent.submit(button.closest('form'));
  fireEvent.submit(button.closest('form'));
  expect(saveList).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Salvando…' }).disabled).toBe(true);
  expect(push).not.toHaveBeenCalled();
  await act(async () => release({ ok: true, data: LIST }));
  expect(push).toHaveBeenCalledWith('/listas/' + LIST.id);
});

test('only an API-listed client UUID is preselected and query changes reset the choice', async () => {
  const view = render(await page(NewListPage, { cliente: CLIENT.id }));
  expect(screen.getByLabelText('Cliente').value).toBe(CLIENT.id);
  view.rerender(await page(NewListPage, {}));
  expect(screen.getByLabelText('Cliente').value).toBe('');
});

test('preselection matches a case-insensitive UUID and uses the actual API option value', async () => {
  const client = { ...DASHBOARD.recentClients[0], id: 'abcdefab-cdef-4abc-8def-abcdefabcdef' };
  fetchMock.mockImplementation(async () => json([client]));
  render(await page(NewListPage, { cliente: client.id.toUpperCase() }));
  expect(screen.getByLabelText('Cliente').value).toBe('abcdefab-cdef-4abc-8def-abcdefabcdef');
});

test('navigating to another persisted list edit page replaces the form values', async () => {
  const view = render(await EditListPage({ params: Promise.resolve({ id: LIST.id }) }));
  const other = { ...LIST, id: COMPLETED_LIST.id, name: 'Casa reformada', description: null };
  fetchMock.mockImplementation(async (url) => url.endsWith('/api/clients') ? json(DASHBOARD.recentClients) : json(other));
  view.rerender(await EditListPage({ params: Promise.resolve({ id: other.id }) }));
  expect(screen.getByLabelText('Nome da lista').value).toBe('Casa reformada');
  expect(screen.getByLabelText('Descrição (opcional)').value).toBe('');
  expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/listas/' + other.id);
});

test.each(['sergio-hooper', '11111111-1111-4111-8111-111111115555', [CLIENT.id]].map((cliente) => [cliente]))(
  'an unknown or malformed client query %j leaves a required choice', async (cliente) => {
    render(await page(NewListPage, { cliente }));
    expect(screen.getByLabelText('Cliente').value).toBe('');
    fireEvent.change(screen.getByLabelText('Nome da lista'), { target: { value: 'Nova casa' } });
    submit();
    expect(screen.getByText('Escolha o cliente desta lista.')).toBeTruthy();
    expect(saveList).not.toHaveBeenCalled();
  },
);

test('no clients from the API offers a real registration link, not fake client options', async () => {
  fetchMock.mockImplementation(async () => json([]));
  render(await page(NewListPage));
  expect(screen.queryByRole('link', { name: 'Cadastre um cliente' })?.getAttribute('href')).toBe('/clientes/novo');
  expect(screen.getByLabelText('Cliente').options).toHaveLength(1);
});

test('list cards format API money and dates, and the completed flag owns their badges', () => {
  const view = render(feedback(<ListCards lists={[{ ...SUMMARY, updatedAt: '2025-09-20T12:00:00Z' }]} />));
  expect(screen.queryByText(/R\$\s25,00/)).not.toBeNull();
  expect(screen.queryByText(/Atualizada em 20 set/)).not.toBeNull();
  expect(screen.queryByText('Concluída')).toBeNull();
  view.rerender(feedback(<ListCards lists={[EMPTY_LIST]} />));
  expect(screen.queryByText('Concluída')).toBeNull();
  expect(screen.getByRole('link', { name: 'Abrir lista' }).getAttribute('href')).toBe('/listas/' + EMPTY_LIST.id);
  view.rerender(feedback(<ListCards lists={[COMPLETED_LIST]} />));
  expect(screen.getByText('Concluída')).toBeTruthy();
});

test.each([['cards', ListCards], ['table', ListsTable]])(
  '%s cancels deletion without a request and retains the persisted row on API failure', async (_, Component) => {
    deleteList.mockResolvedValue({ ok: false, status: 503, detail: 'Tente novamente.', errors: {} });
    const onDeleted = vi.fn();
    render(feedback(<Component lists={[SUMMARY]} onDeleted={onDeleted} />));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(deleteList).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('Os 1 produtos');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
    await waitFor(() => expect(deleteList).toHaveBeenCalledExactlyOnceWith(LIST.id));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Tente novamente.'));
    expect(screen.getByRole('link', { name: 'Casa nova' })).toBeTruthy();
    expect(screen.queryByText('Lista excluída.')).toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  },
);

test.each([['cards', ListCards], ['table', ListsTable]])(
  '%s awaits a single delete, then feedback and refresh; props own the resulting rows', async (_, Component) => {
    let release;
    deleteList.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const onDeleted = vi.fn();
    const view = render(feedback(<Component lists={[SUMMARY]} onDeleted={onDeleted} />));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
    expect(deleteList).toHaveBeenCalledExactlyOnceWith(LIST.id);
    expect(screen.getByRole('link', { name: 'Casa nova' })).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deleteList).toHaveBeenCalledExactlyOnceWith(LIST.id);
    await act(async () => release({ ok: true, data: undefined }));
    expect(screen.getByRole('status').textContent).toContain('Lista excluída.');
    expect(refresh).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('flash')).toBeNull();
    if (Component === ListCards) expect(onDeleted).toHaveBeenCalledExactlyOnceWith(LIST.id);
    expect(screen.getByRole('link', { name: 'Casa nova' })).toBeTruthy();
    view.rerender(feedback(<Component lists={[]} />));
    expect(screen.queryByRole('link', { name: 'Casa nova' })).toBeNull();
  },
);

test('list cards can delete successfully without a completion callback', async () => {
  render(feedback(<ListCards lists={[SUMMARY]} />));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(screen.getByRole('status').textContent).toContain('Lista excluída.');
});

test('failed deletion in an edit form retains the draft and does not navigate', async () => {
  deleteList.mockResolvedValue({ ok: false, status: 404, detail: 'Não encontramos o que você procurava.', errors: {} });
  render(feedback(<ListForm list={LIST} clients={DASHBOARD.recentClients} />));
  fireEvent.change(screen.getByLabelText('Nome da lista'), { target: { value: 'Rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir lista' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Não encontramos o que você procurava.'));
  expect(screen.getByLabelText('Nome da lista').value).toBe('Rascunho');
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.queryByText('Lista excluída.')).toBeNull();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('edit-form deletion flashes only once on the client destination after persistence', async () => {
  vi.useFakeTimers();
  pathname.value = `/listas/${LIST.id}/editar`;
  let release;
  deleteList.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
  const view = render(feedback(<ListForm list={LIST} clients={DASHBOARD.recentClients} />));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir lista' }));
  expect(deleteList).toHaveBeenCalledExactlyOnceWith(LIST.id);
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toBe('');
  expect(sessionStorage.getItem('flash')).toBeNull();
  await act(async () => { release({ ok: true, data: undefined }); });
  expect(push).toHaveBeenCalledExactlyOnceWith(`/clientes/${CLIENT.id}`);
  expect(refresh).toHaveBeenCalledOnce();
  expect(JSON.parse(sessionStorage.getItem('flash')).m).toBe('Lista excluída.');
  const immediateFeedback = screen.getByRole('status').textContent;
  pathname.value = `/clientes/${CLIENT.id}`;
  view.rerender(feedback(<ListCards lists={[]} />));
  await act(async () => { vi.advanceTimersByTime(200); });
  expect(screen.getAllByText('Lista excluída.')).toHaveLength(1);
  expect(immediateFeedback).toBe('');
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test.each([
  ['form', 'success', { ok: true, data: undefined }],
  ['form', 'failure', { ok: false, status: 503, detail: 'Tente novamente.', errors: {} }],
  ['cards', 'success', { ok: true, data: undefined }],
  ['cards', 'failure', { ok: false, status: 503, detail: 'Tente novamente.', errors: {} }],
])('unmounted %s ignores a deferred deletion %s while feedback stays mounted', async (owner, _, result) => {
  let release;
  deleteList.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const onDeleted = vi.fn();
  const view = render(feedback(owner === 'form'
    ? <ListForm list={LIST} clients={DASHBOARD.recentClients} />
    : <ListCards lists={[SUMMARY]} onDeleted={onDeleted} />));
  const status = screen.getByRole('status');
  fireEvent.click(screen.getByRole('button', { name: owner === 'form' ? 'Excluir lista' : 'Excluir Casa nova' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir lista' }));
  expect(deleteList).toHaveBeenCalledExactlyOnceWith(LIST.id);
  expect(screen.queryByRole('alertdialog')).toBeNull();

  view.rerender(feedback(<h2>Outra tela</h2>));
  expect(screen.getByRole('status')).toBe(status);
  await act(async () => release(result));

  expect(screen.getByRole('heading', { name: 'Outra tela' })).toBeTruthy();
  expect(onDeleted).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
  expect(status.textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
  expect(deleteList).toHaveBeenCalledExactlyOnceWith(LIST.id);
});

test('unmounted cards ignore unexpected deferred deletion feedback without bypassing navigation rethrow', async () => {
  let fail;
  deleteList.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }));
  const view = render(feedback(<ListCards lists={[SUMMARY]} />));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  view.rerender(feedback(<h2>Outra tela</h2>));

  const error = new Error('Unexpected deletion failure');
  await act(async () => fail(error));
  expect(unstable_rethrow).toHaveBeenCalledExactlyOnceWith(error);
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});

test('unmounted cards ignore completion feedback after a deferred onDeleted callback', async () => {
  let release;
  const onDeleted = vi.fn(() => new Promise((resolve) => { release = resolve; }));
  const view = render(feedback(<ListCards lists={[SUMMARY]} onDeleted={onDeleted} />));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Casa nova' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledExactlyOnceWith(LIST.id));
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();

  view.rerender(feedback(<h2>Outra tela</h2>));
  await act(async () => release());
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});

test('unmounting the form does not cancel the confirmed server delete or its successful invalidation', async () => {
  const actions = await vi.importActual('./actions');
  deleteList.mockImplementationOnce(actions.deleteList);
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const view = render(feedback(<ListForm list={LIST} clients={DASHBOARD.recentClients} />));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir lista' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/api/lists/' + LIST.id,
    expect.objectContaining({ method: 'DELETE' })));
  expect(revalidatePath).not.toHaveBeenCalled();

  view.rerender(feedback(<h2>Outra tela</h2>));
  await act(async () => release(new Response(null, { status: 204 })));
  expect(revalidatePath.mock.calls).toEqual([
    ['/dashboard'], ['/my-lists'], ['/my-lists/[id]', 'layout'], ['/clientes'], ['/clientes/[id]', 'layout'], ['/listas'], ['/listas/[id]', 'layout'],
  ]);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});

test('the dashboard uses API summaries and server empty counts rather than a demo query', async () => {
  fetchMock.mockImplementation(async (url) => json(url.endsWith('/api/me') ? ME : DASHBOARD));
  const view = render(await page(DashboardPage));
  expect(screen.getByText('Clientes recentes')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Casa nova/ })).toBeTruthy();
  view.rerender(await page(DashboardPage, { estado: 'vazio' }));
  expect(screen.queryByText('Cadastre seu primeiro cliente')).toBeNull();
  fetchMock.mockImplementation(async (url) => json(url.endsWith('/api/me') ? ME : {
    ...DASHBOARD, clientCount: 0, listCount: 0, recentClients: [], recentLists: [],
  }));
  view.rerender(await page(DashboardPage));
  expect(screen.getByText('Cadastre seu primeiro cliente')).toBeTruthy();
});
