import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ShoppingList from './ShoppingList';
import ClientView from './ClientView';
import { ListNote, ListSignature } from './ListFooter';
import { FeedbackProvider } from '../feedback/Feedback';
import { markClientChangesRead } from '../client-changes/actions';
import { patchProduct, deleteProduct, saveProductClientNotes } from '../produtos/actions';
import { LIST, OFFICE, PRODUCT, PUBLIC_LIST, ROOM, SECOND_PRODUCT, SECOND_ROOM } from '@/test-support/fixtures';

const { refresh, push } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }), usePathname: () => '/listas/' + LIST.id,
  unstable_rethrow: vi.fn(),
}));
vi.mock('../client-changes/actions', () => ({ markClientChangesRead: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock('../produtos/actions', () => ({ patchProduct: vi.fn(), deleteProduct: vi.fn(), saveProductClientNotes: vi.fn() }));
vi.mock('./actions', () => ({ rotateShareToken: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  markClientChangesRead.mockResolvedValue({ ok: true });
  saveProductClientNotes.mockReset().mockResolvedValue({ ok: true, data: { ...PRODUCT, clientNotes: 'Saved' } });
  patchProduct.mockReset().mockResolvedValue({ ok: true, data: PRODUCT });
  deleteProduct.mockReset().mockResolvedValue({ ok: true, data: undefined });
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

const fullList = {
  ...LIST,
  stats: { totalProducts: 3, boughtProducts: 1, pendingProducts: 2, estimatedTotal: 40, remainingTotal: 35 },
  rooms: [
    { ...ROOM, products: [
      { ...PRODUCT, unitPrice: 10, links: [] },
      { ...SECOND_PRODUCT, roomId: ROOM.id, name: 'Capacho', quantity: 1, bought: true, unitPrice: 5, links: [] },
    ] },
    { ...SECOND_ROOM, name: 'Lavanderia', products: [
      { ...PRODUCT, id: '44444444-4444-4444-8444-444444447777', roomId: SECOND_ROOM.id,
        name: 'Varal', quantity: 1, unitPrice: 15, links: [{ url: 'https://loja.com.br/varal', note: 'Opção leve' }] },
    ] },
  ],
};
const signature = { officeName: OFFICE.name, architectNames: [...OFFICE.members.map(({ name }) => name), 'Bruna Reis'] };
const viewOf = (list) => <FeedbackProvider><ShoppingList list={list} signature={signature} /></FeedbackProvider>;
const renderFull = () => render(viewOf(fullList));
const summary = (container) => container.querySelector('.summary')?.textContent || '';
const EMPTY = 'Esta lista ainda não tem produtos';

test.each([LIST, { ...LIST, rooms: [], stats: {
  totalProducts: 0, boughtProducts: 0, pendingProducts: 0, estimatedTotal: 0, remainingTotal: 0,
} }])('sharing controls are available regardless of products', (list) => {
  render(viewOf(list));
  expect(screen.queryByRole('button', { name: 'Copiar link' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Gerar novo link' })).not.toBeNull();
  expect(screen.getByRole('textbox', { name: 'Link da lista' }).value).toContain(LIST.shareToken);
});

test('the API room products render quantities and the persisted estimated and remaining totals', () => {
  const { container } = renderFull();
  expect(summary(container)).toMatch(/Itens3Comprados1Pendentes2Estimado R\$\s40,00 · faltam R\$\s35,00/);
  expect(screen.getAllByLabelText('Quantidade').map((input) => input.value)).toEqual(['2', '1', '1']);
  expect(screen.getByRole('link', { name: 'Batedeira' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/${PRODUCT.id}/editar`);
  expect(screen.getByText(/2 un. × R\$\s10,00/)).toBeTruthy();
});

test('a failed purchase update does not change the saved checkbox or totals', async () => {
  patchProduct.mockResolvedValue({ ok: false, status: 503, detail: 'Tente novamente.', errors: {} });
  const { container } = renderFull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  await act(async () => {});
  expect(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }).checked).toBe(false);
  expect(summary(container)).toMatch(/Comprados1Pendentes2Estimado R\$\s40,00 · faltam R\$\s35,00/);
  expect(patchProduct).toHaveBeenCalledWith(LIST.id, PRODUCT.id, { bought: true });
  expect(screen.getByRole('status').textContent).toContain('Tente novamente.');
  expect(screen.queryByText('Marcado como comprado')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

test.each(['', '0', '0.5', '1.5', '1000'])('invalid quantity draft %j is flagged without coercion or persistence', async (draft) => {
  const { container } = renderFull();
  const qty = screen.getAllByLabelText('Quantidade')[0];
  fireEvent.change(qty, { target: { value: draft } });
  fireEvent.blur(qty);
  await act(async () => {});
  expect(qty.getAttribute('aria-invalid')).toBe('true');
  expect(qty.value).toBe(draft);
  expect(summary(container)).toMatch(/Estimado R\$\s40,00/);
  expect(patchProduct).not.toHaveBeenCalled();
});

test.each(['', '0', '0.5', '1.5', '1000'])('an invalid quantity draft %j cannot become a successful purchase after blur', async (draft) => {
  const view = renderFull();
  const qty = screen.getAllByRole('textbox', { name: 'Quantidade' })[0];
  const checkbox = screen.getByRole('checkbox', { name: 'Comprado: Batedeira' });
  fireEvent.change(qty, { target: { value: draft } });
  fireEvent.blur(qty);
  fireEvent.click(checkbox);
  await act(async () => {});
  expect(patchProduct).not.toHaveBeenCalled();
  expect(checkbox.checked).toBe(false);
  expect(qty.value).toBe(draft);
  expect(qty.getAttribute('aria-invalid')).toBe('true');
  expect(summary(view.container)).toMatch(/Comprados1Pendentes2Estimado R\$\s40,00 · faltam R\$\s35,00/);
  expect(screen.queryByText('Marcado como comprado')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

test('correcting an invalid draft permits purchase only after the quantity write completes', async () => {
  const quantityWrite = deferred();
  patchProduct.mockReturnValueOnce(quantityWrite.promise)
    .mockResolvedValueOnce({ ok: true, data: { ...PRODUCT, quantity: 3, bought: true } });
  const view = render(viewOf(LIST));
  const qty = screen.getByRole('textbox', { name: 'Quantidade' });
  const checkbox = screen.getByRole('checkbox', { name: 'Comprado: Batedeira' });
  fireEvent.change(qty, { target: { value: '' } });
  fireEvent.blur(qty);
  fireEvent.click(checkbox);
  await act(async () => {});
  expect(patchProduct).not.toHaveBeenCalled();
  fireEvent.change(qty, { target: { value: '3' } });
  fireEvent.blur(qty);
  fireEvent.click(checkbox);
  await act(async () => {});
  expect(patchProduct).toHaveBeenCalledExactlyOnceWith(LIST.id, PRODUCT.id, { quantity: 3 });
  expect(checkbox.checked).toBe(false);
  expect(screen.queryByText('Marcado como comprado')).toBeNull();
  await act(async () => quantityWrite.resolve({ ok: true, data: { ...PRODUCT, quantity: 3 } }));
  view.rerender(viewOf({ ...LIST, rooms: [{ ...ROOM, products: [{ ...PRODUCT, quantity: 3 }] }],
    stats: { ...LIST.stats, estimatedTotal: 37.50, remainingTotal: 37.50 },
  }));
  await act(async () => fireEvent.click(checkbox));
  expect(patchProduct.mock.calls).toEqual([
    [LIST.id, PRODUCT.id, { quantity: 3 }], [LIST.id, PRODUCT.id, { bought: true }],
  ]);
  expect(qty.value).toBe('3');
  expect(checkbox.checked).toBe(false);
  expect(screen.getByRole('status').textContent).toContain('Marcado como comprado');
  view.rerender(viewOf({ ...LIST, rooms: [{ ...ROOM, products: [{ ...PRODUCT, quantity: 3, bought: true }] }],
    stats: { totalProducts: 1, boughtProducts: 1, pendingProducts: 0, estimatedTotal: 37.50, remainingTotal: 0 },
  }));
  expect(checkbox.checked).toBe(true);
  expect(summary(view.container)).toMatch(/Comprados1Pendentes0Estimado R\$\s37,50 · faltam R\$\s0,00/);
});

test('the filters show only bought or only pending products', () => {
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: /^Comprados/ }));
  expect(screen.getByRole('link', { name: 'Capacho' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Batedeira' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^Pendentes/ }));
  expect(screen.queryByRole('link', { name: 'Capacho' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Varal' })).toBeTruthy();
});

test('an armed remove button disarms after 2.5 seconds and keeps the product', () => {
  vi.useFakeTimers();
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Remover Varal' }));
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.getByRole('button', { name: 'Remover Varal' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Varal' })).toBeTruthy();
});

test('the client preview cannot mark purchases and keeps the API store links and notes', () => {
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.queryAllByRole('checkbox', { name: /^Comprado:/ })).toHaveLength(0);
  expect(screen.queryByRole('link', { name: 'Editar Batedeira' })).toBeNull();
  expect(screen.getByText('Opção leve')).toBeTruthy();
  expect(screen.getByRole('link', { name: /loja.com.br/ }).getAttribute('href')).toBe('https://loja.com.br/varal');
  expect(screen.queryByText(PRODUCT.notes)).toBeNull();
});

test('the client preview accepts the public API subset without fabricated identifiers', () => {
  const rooms = [{
    name: 'Cozinha', products: [{
      name: 'Batedeira', quantity: 2, bought: false, category: PRODUCT.category,
      links: [{ url: 'https://loja.com/item', note: 'Azul' }],
    }],
  }];
  render(<ClientView rooms={rooms} selected={new Set()} onSelect={vi.fn()} onSelectRoom={vi.fn()} isRoomSelected={() => false} />);
  expect(screen.queryByText('2 un.')).not.toBeNull();
  expect(screen.queryByRole('link', { name: /loja.com/ })?.getAttribute('href')).toBe('https://loja.com/item');
  expect(screen.getByText('Azul')).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: /^Comprado:/ })).toBeNull();
});

test('the client preview renders repeated product names as separate rows without purchase controls', () => {
  const publicProduct = { ...PUBLIC_LIST.rooms[0].products[0], category: PRODUCT.category };
  const duplicateRoom = { ...PUBLIC_LIST.rooms[0], products: [publicProduct, {
    ...publicProduct, quantity: 3, bought: true,
  }] };
  render(<ClientView rooms={[duplicateRoom, duplicateRoom, { name: 'Vazio', products: [] }]} selected={new Set()} onSelect={vi.fn()} onSelectRoom={vi.fn()} isRoomSelected={() => false} />);
  expect(screen.queryAllByRole('row')).toHaveLength(6);
  expect(screen.queryAllByText('Batedeira')).toHaveLength(4);
  expect(screen.queryAllByRole('img', { name: 'Comprado' })).toHaveLength(2);
  expect(screen.queryByText('Vazio')).toBeNull();
});

test('the signature uses only the supplied office and all member names', () => {
  const { container } = render(<ListSignature signature={signature} />);
  expect(container.textContent).toContain('Escritório de Ana Lima');
  expect(container.textContent).toContain('Ana Lima');
  expect(container.textContent).toContain('Bruna Reis');
  expect(container.textContent).not.toMatch(/Paula Hooper|Isabela Machado|@fluiar|gmail/);
});

test('the original list note remains unchanged', () => {
  render(<ListNote />);
  expect(screen.getByText(/As opções desta lista foram selecionadas pela Fluiar com todo cuidado/)).toBeTruthy();
  expect(screen.getByText(/A Fluiar não realiza vendas nem se responsabiliza pelas transações/)).toBeTruthy();
  expect(screen.getByText('Condições de pagamento, como parcelamento ou descontos vigentes, e taxa de envio sob consulta direto no site do produto.')).toBeTruthy();
});

test('API image paths use the authenticated local proxy and null prices remain Sem preço', () => {
  const product = { ...PRODUCT, imageUrl: '/api/images/' + PRODUCT.id, unitPrice: null };
  const { container } = render(<ShoppingList list={{
    ...LIST, rooms: [{ ...ROOM, products: [product] }],
    stats: { ...LIST.stats, estimatedTotal: 0, remainingTotal: 0 },
  }} signature={signature} />);
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/' + PRODUCT.id);
  expect(screen.queryByText('Sem preço')).not.toBeNull();
  expect(container.querySelector('.price')?.textContent).not.toContain('0,00');
});

test('the two-step remove button names the product and the pending confirmation', () => {
  render(<ShoppingList list={LIST} signature={signature} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  expect(screen.getByRole('button', { name: 'Confirmar remoção de Batedeira' })).toBeTruthy();
});

test('two taps remove the last product only after deletion and refreshed server props', async () => {
  const deletion = deferred();
  deleteProduct.mockReturnValue(deletion.promise);
  const view = render(viewOf(LIST));
  const remove = screen.getByRole('button', { name: 'Remover Batedeira' });
  fireEvent.click(remove);
  fireEvent.click(remove);
  fireEvent.click(remove);
  await act(async () => {});
  expect(deleteProduct).toHaveBeenCalledExactlyOnceWith(LIST.id, PRODUCT.id);
  expect(screen.getByRole('link', { name: PRODUCT.name })).toBeTruthy();
  expect(screen.queryByText('Item removido')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => deletion.resolve({ ok: true, data: undefined }));
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain('Item removido');
  expect(screen.getByRole('link', { name: PRODUCT.name })).toBeTruthy();
  view.rerender(viewOf({ ...LIST, rooms: [{ ...ROOM, products: [] }], stats: {
    totalProducts: 0, boughtProducts: 0, pendingProducts: 0, estimatedTotal: 0, remainingTotal: 0,
  } }));
  expect(screen.getByText(EMPTY)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.getByText(EMPTY)).toBeTruthy();
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test.each([
  ['purchase', { bought: true }, 'Marcado como comprado'],
  ['quantity', { quantity: 3 }, 'Salvo'],
])('%s stays pending and uses only refreshed server products and stats after confirmation', async (operation, patch, message) => {
  const write = deferred();
  patchProduct.mockReturnValue(write.promise);
  const view = renderFull();
  const checkbox = screen.getByRole('checkbox', { name: 'Comprado: Batedeira' });
  const qty = screen.getAllByRole('textbox', { name: 'Quantidade' })[0];
  if (operation === 'purchase') fireEvent.click(checkbox);
  else {
    fireEvent.change(qty, { target: { value: '3' } });
    qty.focus();
    fireEvent.keyDown(qty, { key: 'Enter' });
    fireEvent.blur(qty);
  }
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  fireEvent.blur(qty);
  await act(async () => {});
  expect(patchProduct).toHaveBeenCalledExactlyOnceWith(LIST.id, PRODUCT.id, patch);
  expect(deleteProduct).not.toHaveBeenCalled();
  expect(checkbox.disabled).toBe(true);
  expect(qty.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Remover Batedeira' }).disabled).toBe(true);
  expect(screen.getByRole('checkbox', { name: 'Comprado: Varal' }).disabled).toBe(false);
  expect(checkbox.checked).toBe(false);
  expect(summary(view.container)).toMatch(/Estimado R\$\s40,00 · faltam R\$\s35,00/);
  expect(screen.queryByText(message)).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => write.resolve({ ok: true, data: { ...PRODUCT, bought: true, quantity: 4 } }));
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain(message);
  expect(checkbox.checked).toBe(false);
  expect(qty.value).toBe('2');
  view.rerender(viewOf({
    ...fullList, updatedAt: '2026-10-31T16:00:00Z',
    rooms: [{ ...ROOM, products: [{ ...PRODUCT, bought: true, quantity: 4, unitPrice: 10 }] }],
    stats: { totalProducts: 7, boughtProducts: 5, pendingProducts: 2, estimatedTotal: 123.45, remainingTotal: 23.45 },
  }));
  expect(checkbox.checked).toBe(true);
  expect(qty.value).toBe('4');
  expect(summary(view.container)).toMatch(/Itens7Comprados5Pendentes2Estimado R\$\s123,45 · faltam R\$\s23,45/);
});

test('failed quantity persistence restores the server value and displays the API field error', async () => {
  patchProduct.mockResolvedValue({ ok: false, status: 400, detail: 'Revise os campos destacados.',
    errors: { quantity: 'Use um valor até 999.' } });
  renderFull();
  const qty = screen.getAllByRole('textbox', { name: 'Quantidade' })[0];
  fireEvent.change(qty, { target: { value: '3' } });
  fireEvent.blur(qty);
  await act(async () => {});
  expect(patchProduct).toHaveBeenCalledWith(LIST.id, PRODUCT.id, { quantity: 3 });
  expect(qty.value).toBe('2');
  expect(qty.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(qty.getAttribute('aria-describedby')).textContent).toBe('Use um valor até 999.');
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.change(qty, { target: { value: '4' } });
  expect(qty.getAttribute('aria-invalid')).toBe('false');
});

test('a failed delete keeps the saved row and totals and requires confirmation on retry', async () => {
  deleteProduct.mockResolvedValue({ ok: false, status: 404, detail: 'Não encontramos o que você procurava.', errors: {} });
  const view = renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção de Batedeira' }));
  await act(async () => {});
  expect(screen.getByRole('link', { name: 'Batedeira' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remover Batedeira' }).disabled).toBe(false);
  expect(summary(view.container)).toMatch(/Itens3Comprados1Pendentes2/);
  expect(screen.getByRole('status').textContent).toContain('Não encontramos o que você procurava.');
  expect(screen.queryByText('Item removido')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

test('filter selection survives a refreshed list and pending row guards survive hiding and showing it', async () => {
  const write = deferred();
  patchProduct.mockReturnValue(write.promise);
  const view = renderFull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  fireEvent.click(screen.getByRole('button', { name: /^Comprados/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Pendentes/ }));
  const checkbox = screen.getByRole('checkbox', { name: 'Comprado: Batedeira' });
  expect(checkbox.disabled).toBe(true);
  fireEvent.click(checkbox);
  await act(async () => {});
  expect(patchProduct).toHaveBeenCalledOnce();
  await act(async () => write.resolve({ ok: true, data: { ...PRODUCT, bought: true } }));
  view.rerender(viewOf({ ...fullList, updatedAt: '2026-10-31T16:00:00Z',
    rooms: fullList.rooms.map((room) => ({ ...room, products: room.products.map((product) =>
      product.id === PRODUCT.id ? { ...product, bought: true } : product) })),
    stats: { ...fullList.stats, boughtProducts: 2, pendingProducts: 1 },
  }));
  expect(screen.queryByRole('link', { name: 'Batedeira' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Varal' })).toBeTruthy();
  const filterButton = screen.getByRole('button', { name: /^Pendentes/ });
  expect(filterButton.textContent).toMatch(/Pendentes\s*1/);
  expect(filterButton.getAttribute('aria-pressed')).toBe('true');
});

test.each([true, false])('unmount during a write suppresses late success or failure feedback and refresh (%s)', async (ok) => {
  const write = deferred();
  patchProduct.mockReturnValue(write.promise);
  const view = render(viewOf(LIST));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  await act(async () => write.resolve(ok ? { ok: true, data: PRODUCT }
    : { ok: false, status: 503, detail: 'Tente novamente.', errors: {} }));
  expect(patchProduct).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('another list owns fresh filters and ignores a previous list in-flight completion', async () => {
  const write = deferred();
  patchProduct.mockReturnValue(write.promise);
  const view = renderFull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  fireEvent.click(screen.getByRole('button', { name: /^Comprados/ }));
  view.rerender(viewOf({ ...LIST, id: '22222222-2222-4222-8222-222222225555' }));
  expect(screen.getByRole('link', { name: 'Batedeira' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }).disabled).toBe(false);
  await act(async () => write.resolve({ ok: true, data: PRODUCT }));
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toBe('');
});

test('a synchronously rejected write releases the row so it can be retried', async () => {
  patchProduct.mockImplementationOnce(() => { throw new Error('Action failed before dispatch'); });
  render(viewOf(LIST));
  const checkbox = screen.getByRole('checkbox', { name: 'Comprado: Batedeira' });
  await act(async () => fireEvent.click(checkbox));
  expect(checkbox.checked).toBe(false);
  expect(screen.getByRole('status').textContent).toContain('Não conseguimos salvar agora. Tente novamente.');
  expect(checkbox.disabled).toBe(false);
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(checkbox));
  expect(patchProduct).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledOnce();
});

test('a real empty API list has its empty state and can display only real signature text', () => {
  render(<ShoppingList list={{
    ...LIST, rooms: [], stats: { totalProducts: 0, boughtProducts: 0, pendingProducts: 0, estimatedTotal: 0, remainingTotal: 0 },
  }} signature={signature} />);
  expect(screen.queryByText(EMPTY)).not.toBeNull();
  expect(screen.queryByRole('link', { name: 'Adicionar primeiro produto' })?.getAttribute('href'))
    .toBe('/listas/' + LIST.id + '/ambientes');
  expect(screen.getByText('Bruna Reis')).toBeTruthy();
});

test.each([[[], '/ambientes'], [[{ ...ROOM, products: [] }], '/produtos/novo']])(
  'empty lists retain edit and room navigation and choose a product CTA from room presence', (rooms, target) => {
    render(<ShoppingList list={{ ...LIST, rooms,
      stats: { totalProducts: 0, boughtProducts: 0, pendingProducts: 0, estimatedTotal: 0, remainingTotal: 0 },
    }} signature={signature} />);
    expect(screen.getByRole('link', { name: 'Gerenciar ambientes' }).getAttribute('href')).toBe(`/listas/${LIST.id}/ambientes`);
    expect(screen.getByRole('link', { name: 'Editar lista' }).getAttribute('href')).toBe(`/listas/${LIST.id}/editar`);
    expect(screen.getByRole('link', { name: 'Adicionar primeiro produto' }).getAttribute('href')).toBe(`/listas/${LIST.id}${target}`);
    fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
    expect(screen.queryByRole('link', { name: 'Gerenciar ambientes' })).toBeNull();
  },
);

test('populated lists expose room management without changing product controls or client mode', () => {
  renderFull();
  expect(screen.getByRole('link', { name: 'Gerenciar ambientes' }).getAttribute('href')).toBe(`/listas/${LIST.id}/ambientes`);
  expect(screen.getByRole('link', { name: 'Adicionar produto' }).getAttribute('href')).toBe(`/listas/${LIST.id}/produtos/novo`);
  expect(screen.getAllByRole('checkbox', { name: /^Comprado:/ })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.queryByRole('link', { name: 'Gerenciar ambientes' })).toBeNull();
});

test('admins can edit client observations and the preview remains read only', async () => {
  const list = { ...LIST, rooms: [{ ...ROOM, products: [{ ...PRODUCT, clientNotes: 'Bought locally' }] }] };
  render(viewOf(list));
  const input = screen.getByRole('textbox', { name: `Observação do cliente: ${PRODUCT.name}` });
  expect(input.value).toBe('Bought locally');
  fireEvent.change(input, { target: { value: 'Saved' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: `Salvar observação de ${PRODUCT.name}` })));
  expect(saveProductClientNotes).toHaveBeenCalledWith(LIST.id, PRODUCT.id, 'Saved');
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.getByText('Bought locally')).toBeTruthy();
  expect(screen.queryByRole('button', { name: `Salvar observação de ${PRODUCT.name}` })).toBeNull();
});

test('client change highlights survive refresh and filters during the visit', async () => {
  const changed = { ...fullList, clientChanges: { observedRevision: 1, products: [{ productId: PRODUCT.id,
    purchase: { revision: 1, changedAt: '2026-11-05T12:00:00Z', value: true } }] } };
  const view = render(viewOf(changed));
  expect(screen.getByText('Alterado pelo cliente')).toBeTruthy();
  view.rerender(viewOf({ ...fullList, clientChanges: { observedRevision: 2, products: [] } }));
  expect(screen.getByText('Alterado pelo cliente')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Comprados/ }));
  expect(screen.queryByText('Alterado pelo cliente')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
  expect(screen.getByText('Alterado pelo cliente')).toBeTruthy();
  await act(async () => {});
});

test('refresh never confirms changes that arrived after opening and reentry starts a new visit', async () => {
  const snapshot = { observedRevision: 1, products: [{ productId: PRODUCT.id,
    purchase: { revision: 1, changedAt: '2026-11-05T12:00:00Z', value: true } }] };
  const view = render(viewOf({ ...fullList, clientChanges: snapshot }));
  await act(async () => {});
  expect(markClientChangesRead).toHaveBeenCalledExactlyOnceWith(LIST.id, 1);
  view.rerender(viewOf({ ...fullList, clientChanges: { ...snapshot, observedRevision: 2 } }));
  await act(async () => {});
  expect(markClientChangesRead).toHaveBeenCalledTimes(1);
  view.unmount();
  render(viewOf({ ...fullList, clientChanges: { observedRevision: 2, products: [] } }));
  expect(screen.queryByText('Alterado pelo cliente')).toBeNull();
});
test('deleted products do not render ghost rows and bought highlights retain the done class', async () => {
  const snapshot = { observedRevision: 1, products: [{ productId: SECOND_PRODUCT.id,
    purchase: { revision: 1, changedAt: '2026-11-05T12:00:00Z', value: true } }] };
  const view = render(viewOf({ ...fullList, clientChanges: snapshot }));
  expect(screen.getByText('Alterado pelo cliente').closest('tr').classList.contains('done')).toBe(true);
  view.rerender(viewOf({ ...fullList, clientChanges: snapshot, rooms: fullList.rooms.map((room) => ({ ...room,
    products: room.products.filter((product) => product.id !== SECOND_PRODUCT.id) })) }));
  expect(screen.queryByText('Alterado pelo cliente')).toBeNull();
  await act(async () => {});
});

const ELETRO = PRODUCT.category;
const LUZ = { id: '55555555-5555-4555-8555-555555555552', name: 'Luminotécnica', deleted: false };
const categorized = (overrides = {}) => ({
  ...fullList,
  rooms: [
    { ...ROOM, products: [
      { ...PRODUCT, unitPrice: 10, links: [] },
      { ...SECOND_PRODUCT, roomId: ROOM.id, name: 'Capacho', quantity: 1, bought: true, unitPrice: 5, links: [] },
    ] },
    { ...SECOND_ROOM, name: 'Lavanderia', products: [
      { ...PRODUCT, id: '44444444-4444-4444-8444-444444447777', roomId: SECOND_ROOM.id,
        name: 'Varal', quantity: 1, unitPrice: 15, category: LUZ, bought: true, links: [] },
    ] },
  ],
  ...overrides,
});
const pick = (name) => fireEvent.change(screen.getByRole('combobox', { name: 'Categoria' }), { target: { value: name } });
const idOf = (c) => c.id;

test('filters items by category', () => {
  render(viewOf(categorized()));
  pick(idOf(LUZ));
  expect(screen.queryByText('Varal')).not.toBeNull();
  expect(screen.queryByText('Batedeira')).toBeNull();
  expect(screen.queryByText('Capacho')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Cozinha' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Lavanderia' })).not.toBeNull();
});

test('offers only categories present in the list', () => {
  render(viewOf(categorized()));
  const labels = [...screen.getByRole('combobox', { name: 'Categoria' }).querySelectorAll('option')].map((o) => o.textContent);
  expect(labels).toEqual(['Todas as categorias', 'Eletrodomésticos', 'Luminotécnica']);
});

test('combines with status filter and keeps category', () => {
  render(viewOf(categorized()));
  pick(idOf(LUZ));
  fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));
  expect(screen.queryByText('Nenhum item desta categoria com esse status.')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
  expect(screen.getByRole('combobox', { name: 'Categoria' }).value).toBe(LUZ.id);
});

test('falls back to all when category disappears', () => {
  const rendered = render(viewOf(categorized()));
  pick(idOf(LUZ));
  expect(screen.queryByText('Batedeira')).toBeNull();
  const without = categorized();
  without.rooms = [{ ...without.rooms[0] }];
  rendered.rerender(viewOf(without));
  expect(screen.getByRole('combobox', { name: 'Categoria' }).value).toBe('');
  expect(screen.queryByText('Batedeira')).not.toBeNull();
  expect(screen.queryByText('Capacho')).not.toBeNull();
});

test('shows the category under each item name', () => {
  render(viewOf(categorized()));
  expect(screen.getAllByText('Eletrodomésticos', { selector: '.ro-cat' })).toHaveLength(2);
  expect(screen.getAllByText('Luminotécnica', { selector: '.ro-cat' })).toHaveLength(1);
});

test('client preview filters by category and status, and hides the edit controls', () => {
  render(viewOf(categorized()));
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.queryByRole('link', { name: 'Editar lista' })).toBeNull();
  pick(idOf(LUZ));
  expect(screen.queryByText('Varal')).not.toBeNull();
  expect(screen.queryByText('Batedeira')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Cozinha' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));
  expect(screen.getByText('Nenhum item desta categoria com esse status.')).toBeTruthy();
});

test('client preview status filter hides done items', () => {
  const { container } = renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(container.querySelector('.summary')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Comprados/ }));
  expect(screen.queryByText('Capacho')).not.toBeNull();
  expect(screen.queryByText('Batedeira')).toBeNull();
});

const printSheet = () => document.body.querySelector(':scope > .print-sheet');
const printBox = (name) => screen.getByRole('checkbox', { name: `Imprimir: ${name}` });
const sheetItems = (container) => [...printSheet(container).querySelectorAll('tbody td:nth-child(2)')].map((td) => td.textContent);

test('print selection shows the count, prints only the marked item and does not change purchases', () => {
  window.print = vi.fn();
  const { container } = renderFull();
  fireEvent.click(printBox('Varal'));
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  expect(sheetItems(container)).toEqual(['Varal']);
  expect(printSheet(container).textContent).toContain(`Cliente: ${fullList.clientName}`);
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir selecionados' }));
  expect(window.print).toHaveBeenCalledOnce();
  expect(patchProduct).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox', { name: 'Comprado: Varal' }).checked).toBe(false);
});

test('the room checkbox selects every item of that room', () => {
  const { container } = renderFull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos de Cozinha' }));
  expect(screen.getByText('2 itens selecionados')).toBeTruthy();
  expect(sheetItems(container)).toEqual(['Batedeira', 'Capacho']);
});

test('print selection survives a filter change and a refreshed list, and drops removed products', () => {
  const { container, rerender } = renderFull();
  fireEvent.click(printBox('Capacho'));
  fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));
  expect(screen.queryByRole('checkbox', { name: 'Imprimir: Capacho' })).toBeNull();
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  expect(sheetItems(container)).toEqual(['Capacho']);
  rerender(viewOf({ ...fullList, updatedAt: '2026-11-06T10:00:00Z' }));
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  const without = { ...fullList, rooms: [{ ...fullList.rooms[0], products: [fullList.rooms[0].products[0]] }, fullList.rooms[1]] };
  rerender(viewOf(without));
  expect(screen.queryByText('1 item selecionado')).toBeNull();
});

test('the client preview has print selection and keeps it from edit mode', () => {
  window.print = vi.fn();
  const { container } = renderFull();
  fireEvent.click(printBox('Capacho'));
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.getByText('1 item selecionado')).toBeTruthy();
  expect(printBox('Capacho').checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos de Lavanderia' }));
  expect(screen.getByText('2 itens selecionados')).toBeTruthy();
  expect(sheetItems(container)).toEqual(['Capacho', 'Varal']);
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir selecionados' }));
  expect(window.print).toHaveBeenCalledOnce();
  expect(screen.queryAllByRole('checkbox', { name: /^Comprado:/ })).toHaveLength(0);
});

test('the client preview shows the product photo', () => {
  const product = { ...PRODUCT, imageUrl: '/api/images/' + PRODUCT.id };
  const { container } = render(viewOf({ ...LIST, rooms: [{ ...ROOM, products: [product] }] }));
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(container.querySelector('.thumb img')?.getAttribute('src')).toBe('/images/' + PRODUCT.id);
});
