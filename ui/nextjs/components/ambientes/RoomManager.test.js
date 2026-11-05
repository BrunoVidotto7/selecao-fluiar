import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import RoomManager from './RoomManager';
import { FeedbackProvider } from '../feedback/Feedback';
import { createRoom, renameRoom, deleteRoom, reorderRooms } from './actions';
import { LIST, ROOM, SECOND_ROOM, PRODUCT, SECOND_PRODUCT } from '@/test-support/fixtures';

const { refresh, push } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }), usePathname: () => `/listas/${LIST.id}/ambientes`,
  unstable_rethrow: (error) => { if (error.message === 'NEXT_REDIRECT') throw error; },
}));
vi.mock('./actions', () => ({ createRoom: vi.fn(), renameRoom: vi.fn(), deleteRoom: vi.fn(), reorderRooms: vi.fn() }));
const rooms = [ROOM, SECOND_ROOM];
const renderManager = (incoming = rooms) => render(<FeedbackProvider><RoomManager listId={LIST.id} rooms={incoming} /></FeedbackProvider>);
const rowNames = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
const submitName = async (name, label = 'Adicionar ambiente') => {
  fireEvent.change(screen.getByLabelText('Nome do ambiente'), { target: { value: name } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })); });
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const FAILURE = { ok: false, status: 503, detail: 'Tente novamente.', errors: {} };
const DUPLICATE = 'Já existe um ambiente com esse nome nesta lista.';
const INCOMPLETE = 'Envie todos os ambientes da lista, sem repetir.';

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockReset();
  createRoom.mockReset().mockResolvedValue({ ok: true, data: { ...ROOM, products: [] } });
  renameRoom.mockReset().mockResolvedValue({ ok: true, data: { ...ROOM, name: 'Quarto' } });
  deleteRoom.mockReset().mockResolvedValue({ ok: true, data: undefined });
  reorderRooms.mockReset().mockResolvedValue({ ok: true, data: [SECOND_ROOM, ROOM] });
});

test('each room offers product creation with its own room UUID selected', () => {
  renderManager();
  const rows = within(screen.getByRole('list', { name: 'Ambientes' })).getAllByRole('listitem');
  expect(within(rows[0]).getByRole('link', { name: 'Adicionar produto' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/novo?ambiente=${ROOM.id}`);
  expect(within(rows[1]).getByRole('link', { name: 'Adicionar produto' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/novo?ambiente=${SECOND_ROOM.id}`);
});

test('a newly created empty room offers a link to add its first product after refresh', async () => {
  const room = { ...ROOM, name: 'Quarto', products: [] };
  createRoom.mockResolvedValue({ ok: true, data: room });
  const view = renderManager([]);
  expect(screen.queryByRole('link', { name: 'Adicionar produto' })).toBeNull();
  await submitName('Quarto');
  expect(refresh).toHaveBeenCalledOnce();
  view.rerender(<FeedbackProvider><RoomManager listId={LIST.id} rooms={[room]} /></FeedbackProvider>);
  expect(screen.getByRole('heading', { name: 'Quarto' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Adicionar produto' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/novo?ambiente=${ROOM.id}`);
});

test('moving a room sends every UUID once in the new order without locally reordering persisted rows', async () => {
  const view = renderManager();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mover Cozinha para baixo' })); });
  expect(reorderRooms).toHaveBeenCalledExactlyOnceWith(LIST.id, [SECOND_ROOM.id, ROOM.id]);
  expect(refresh).toHaveBeenCalledOnce();
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  view.rerender(<FeedbackProvider><RoomManager listId={LIST.id} rooms={[SECOND_ROOM, ROOM]} /></FeedbackProvider>);
  expect(rowNames()).toEqual(['Sala', 'Cozinha']);
});

test.each([
  ['keeps the same direction', 'Mover Quarto para cima', 'Mover Quarto para cima'],
  ['switches direction at an edge', 'Mover Sala para baixo', 'Mover Sala para cima'],
])('a successful move %s on the moved room once the new order renders', async (_, clicked, focused) => {
  const third = { ...ROOM, id: '33333333-3333-4333-8333-333333336666', name: 'Quarto', position: 2, products: [] };
  const view = renderManager([ROOM, SECOND_ROOM, third]);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: clicked })); });
  const [, ids] = reorderRooms.mock.calls[0];
  const byId = { [ROOM.id]: ROOM, [SECOND_ROOM.id]: SECOND_ROOM, [third.id]: third };
  view.rerender(<FeedbackProvider><RoomManager listId={LIST.id} rooms={ids.map((id) => byId[id])} /></FeedbackProvider>);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: focused }));
});

test('first and last rooms cannot move past their boundaries', () => {
  renderManager();
  expect(screen.getByRole('button', { name: 'Mover Cozinha para cima' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Mover Sala para baixo' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Mover Cozinha para baixo' }).disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'Mover Sala para cima' }).disabled).toBe(false);
});

test('a duplicate room name stays editable and displays the unchanged API field error and detail', async () => {
  createRoom.mockResolvedValue({ ok: false, status: 409, detail: DUPLICATE, errors: { name: DUPLICATE } });
  renderManager();
  await submitName('Cozinha');
  const input = screen.getByLabelText('Nome do ambiente');
  expect(input.value).toBe('Cozinha');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe(DUPLICATE);
  expect(screen.getByRole('status').textContent).toContain(DUPLICATE);
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'Quarto' } });
  expect(input.getAttribute('aria-invalid')).toBe('false');
});

test.each([['   ', 'Preencha este campo.'], ['a'.repeat(61), 'Use no máximo 60 caracteres.']])(
  'invalid room name %j never submits', async (name, message) => {
    renderManager();
    await submitName(name);
    expect(createRoom).not.toHaveBeenCalled();
    const input = screen.getByLabelText('Nome do ambiente');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe(message);
    expect(document.activeElement).toBe(input);
  },
);

test('creating a room awaits persistence, clears only its draft and refreshes incoming rows', async () => {
  const write = deferred();
  createRoom.mockReturnValue(write.promise);
  renderManager([]);
  await submitName('Quarto');
  expect(createRoom).toHaveBeenCalledExactlyOnceWith(LIST.id, { name: 'Quarto' });
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'Quarto' })).toBeNull();
  await act(async () => { write.resolve({ ok: true, data: { ...ROOM, name: 'Quarto', products: [] } }); });
  expect(screen.getByLabelText('Nome do ambiente').value).toBe('');
  expect(screen.getByRole('status').textContent).toContain('Ambiente criado.');
  expect(refresh).toHaveBeenCalledOnce();
});

test('renaming submits the room UUID with its unique input ID and leaves server names authoritative', async () => {
  renderManager();
  fireEvent.click(screen.getAllByRole('button', { name: 'Renomear' })[1]);
  const input = screen.getByLabelText('Nome do ambiente de Sala');
  expect(input.id).toContain(SECOND_ROOM.id);
  expect(input.value).toBe('Sala');
  fireEvent.change(input, { target: { value: 'Quarto' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' })); });
  expect(renameRoom).toHaveBeenCalledExactlyOnceWith(SECOND_ROOM.id, { name: 'Quarto' });
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  expect(refresh).toHaveBeenCalledOnce();
});

test('invalid rename drafts never write and a duplicate rename remains editable', async () => {
  renameRoom.mockResolvedValue({ ok: false, status: 409, detail: DUPLICATE, errors: { name: DUPLICATE } });
  renderManager();
  fireEvent.click(screen.getAllByRole('button', { name: 'Renomear' })[0]);
  const input = screen.getByLabelText('Nome do ambiente de Cozinha');
  for (const value of ['', 'a'.repeat(61)]) {
    fireEvent.change(input, { target: { value } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' })); });
    expect(renameRoom).not.toHaveBeenCalled();
  }
  fireEvent.change(input, { target: { value: 'Sala' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' })); });
  expect(input.value).toBe('Sala');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(refresh).not.toHaveBeenCalled();
});

test('canceling a rename leaves the persisted room unchanged without writing', () => {
  renderManager();
  fireEvent.click(screen.getAllByRole('button', { name: 'Renomear' })[0]);
  fireEvent.change(screen.getByLabelText('Nome do ambiente de Cozinha'), { target: { value: 'Outro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar renomeação' }));
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  expect(renameRoom).not.toHaveBeenCalled();
});

test('delete warns of the actual cascade product count and cancel makes no write', () => {
  renderManager([{ ...ROOM, products: [PRODUCT, { ...SECOND_PRODUCT, roomId: ROOM.id }] }]);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir ambiente' }));
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.textContent).toContain('Cozinha');
  expect(dialog.textContent).toContain('Os 2 produtos deste ambiente também serão excluídos.');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(deleteRoom).not.toHaveBeenCalled();
  expect(rowNames()).toEqual(['Cozinha']);
});

test('confirmed delete waits for persistence and never optimistically removes products or rooms', async () => {
  const write = deferred();
  deleteRoom.mockReturnValue(write.promise);
  const view = renderManager();
  fireEvent.click(screen.getAllByRole('button', { name: 'Excluir ambiente' })[0]);
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir ambiente' })); });
  expect(deleteRoom).toHaveBeenCalledExactlyOnceWith(ROOM.id);
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { write.resolve({ ok: true, data: undefined }); });
  expect(refresh).toHaveBeenCalledOnce();
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  view.rerender(<FeedbackProvider><RoomManager listId={LIST.id} rooms={[SECOND_ROOM]} /></FeedbackProvider>);
  expect(rowNames()).toEqual(['Sala']);
});

test.each(['delete', 'reorder'])('a failed %s leaves server rows and order unchanged', async (operation) => {
  deleteRoom.mockResolvedValue(FAILURE);
  reorderRooms.mockResolvedValue(FAILURE);
  renderManager();
  await act(async () => {
    if (operation === 'delete') {
      fireEvent.click(screen.getAllByRole('button', { name: 'Excluir ambiente' })[0]);
    } else fireEvent.click(screen.getByRole('button', { name: 'Mover Sala para cima' }));
  });
  if (operation === 'delete') await act(async () => {
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir ambiente' }));
  });
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain(FAILURE.detail);
});

test('an incomplete reorder shows the exact detail and refreshes for a complete retry including a concurrent room', async () => {
  reorderRooms.mockResolvedValueOnce({ ok: false, status: 400, detail: INCOMPLETE, errors: { roomIds: INCOMPLETE } });
  const view = renderManager();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mover Cozinha para baixo' })); });
  expect(screen.getByRole('status').textContent).toContain(INCOMPLETE);
  expect(refresh).toHaveBeenCalledOnce();
  expect(rowNames()).toEqual(['Cozinha', 'Sala']);
  const third = { ...ROOM, id: '33333333-3333-4333-8333-333333337777', name: 'Quarto', position: 2, products: [] };
  view.rerender(<FeedbackProvider><RoomManager listId={LIST.id} rooms={[...rooms, third]} /></FeedbackProvider>);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mover Cozinha para baixo' })); });
  expect(reorderRooms).toHaveBeenLastCalledWith(LIST.id, [SECOND_ROOM.id, ROOM.id, third.id]);
});

test('zero rooms offer a name form and never request an empty reorder', () => {
  renderManager([]);
  expect(screen.queryByLabelText('Nome do ambiente')).not.toBeNull();
  expect(screen.queryByRole('button', { name: /Mover/ })).toBeNull();
  expect(reorderRooms).not.toHaveBeenCalled();
});

test.each(['create', 'rename', 'delete', 'reorder'])('pending %s blocks duplicate and competing writes', async (operation) => {
  const write = deferred();
  const actions = { create: createRoom, rename: renameRoom, delete: deleteRoom, reorder: reorderRooms };
  actions[operation].mockReturnValue(write.promise);
  renderManager();
  if (operation === 'create') {
    await submitName('Quarto');
    fireEvent.submit(screen.getByLabelText('Nome do ambiente').closest('form'));
  } else if (operation === 'rename') {
    fireEvent.click(screen.getAllByRole('button', { name: 'Renomear' })[0]);
    const input = screen.getByLabelText('Nome do ambiente de Cozinha');
    fireEvent.change(input, { target: { value: 'Quarto' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' })); });
    fireEvent.submit(input.closest('form'));
  } else if (operation === 'delete') {
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir ambiente' })[0]);
    await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir ambiente' })); });
  } else await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mover Cozinha para baixo' })); });
  fireEvent.click(screen.getByRole('button', { name: 'Mover Sala para cima' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Excluir ambiente' })[0]);
  expect(actions[operation]).toHaveBeenCalledOnce();
  for (const [name, action] of Object.entries(actions)) if (name !== operation) expect(action).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { write.resolve({ ok: true, data: ROOM }); });
});

test.each(['create', 'rename', 'delete', 'reorder'])('unmounted %s owners suppress late feedback and navigation', async (operation) => {
  const write = deferred();
  ({ create: createRoom, rename: renameRoom, delete: deleteRoom, reorder: reorderRooms })[operation].mockReturnValue(write.promise);
  const view = renderManager();
  if (operation === 'create') await submitName('Quarto');
  else if (operation === 'rename') {
    fireEvent.click(screen.getAllByRole('button', { name: 'Renomear' })[0]);
    fireEvent.change(screen.getByLabelText('Nome do ambiente de Cozinha'), { target: { value: 'Quarto' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' })); });
  } else if (operation === 'delete') {
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir ambiente' })[0]);
    await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir ambiente' })); });
  } else await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mover Cozinha para baixo' })); });
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  await act(async () => { write.resolve({ ok: true, data: ROOM }); });
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('an unmounted reorder owner also suppresses late error refresh and toast', async () => {
  const write = deferred();
  reorderRooms.mockReturnValue(write.promise);
  const view = renderManager();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mover Cozinha para baixo' })); });
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  await act(async () => { write.resolve({ ok: false, status: 400, detail: INCOMPLETE, errors: { roomIds: INCOMPLETE } }); });
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});
