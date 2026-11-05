import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ProductForm from './ProductForm';
import NewProductPage from '@/app/(app)/(admin)/listas/[id]/produtos/novo/page';
import EditProductPage from '@/app/(app)/(admin)/listas/[id]/produtos/[produtoId]/editar/page';
import { FeedbackProvider } from '../feedback/Feedback';
import { LIST, ROOM, PRODUCT, SECOND_ROOM } from '@/test-support/fixtures';
import { saveProduct, uploadProductImage, deleteProductImage, deleteProduct } from './actions';
import { getList } from '../listas/queries.server';

const { push, refresh, createUrl, revokeUrl } = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }), usePathname: () => '/listas',
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  unstable_rethrow: (error) => { if (error.message.startsWith('NEXT_')) throw error; },
}));
vi.mock('./actions', () => ({
  saveProduct: vi.fn(), uploadProductImage: vi.fn(), deleteProductImage: vi.fn(), deleteProduct: vi.fn(),
}));
vi.mock('../listas/queries.server', () => ({ getList: vi.fn() }));

const PARTIAL_COPY = 'O produto foi salvo, mas a imagem não foi atualizada. Tente novamente.';
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_URL = '/api/images/99999999-9999-4999-8999-999999999999';
const LOCAL_IMAGE_URL = '/images/99999999-9999-4999-8999-999999999999';
const newProductPage = (query = {}) => NewProductPage({
  params: Promise.resolve({ id: LIST.id }), searchParams: Promise.resolve(query),
});
const editProductPage = () => EditProductPage({ params: Promise.resolve({ id: LIST.id, produtoId: PRODUCT.id }) });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const fillNew = () => {
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira' } });
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: ROOM.id } });
};
const submit = async () => {
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Salvar produto' }).closest('form')); });
};
const pick = (file = new File(['png'], 'foto.png', { type: 'image/png' })) => {
  fireEvent.change(screen.getByLabelText(/Escolher imagem|Trocar imagem/), { target: { files: [file] } });
  return file;
};
const mount = (props = {}) => render(<FeedbackProvider><ProductForm listId={LIST.id} rooms={[ROOM, SECOND_ROOM]} {...props} /></FeedbackProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  saveProduct.mockReset().mockResolvedValue({ ok: true, data: PRODUCT });
  uploadProductImage.mockReset().mockResolvedValue({ ok: true, data: { imageUrl: IMAGE_URL } });
  deleteProductImage.mockReset().mockResolvedValue({ ok: true, data: undefined });
  deleteProduct.mockReset().mockResolvedValue({ ok: true, data: undefined });
  getList.mockReset().mockResolvedValue(LIST);
  createUrl.mockReset().mockReturnValue('blob:preview');
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createUrl;
    static revokeObjectURL = revokeUrl;
  });
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test('the new product form resets its room and draft when only the UUID query changes', async () => {
  const view = render(await newProductPage({ ambiente: ROOM.id }));
  expect(screen.getByLabelText('Ambiente').value).toBe(ROOM.id);
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Rascunho' } });
  view.rerender(await newProductPage({}));
  expect(screen.getByLabelText('Ambiente').value).toBe('');
  expect(screen.getByLabelText('Nome do produto').value).toBe('');
});

test.each([['inexistente'], [['Cozinha', 'Sala']], [SECOND_ROOM.id]])(
  'an unknown or malformed room query %j leaves room selection blank', async (ambiente) => {
    render(await newProductPage({ ambiente }));
    expect(screen.getByLabelText('Ambiente').value).toBe('');
    fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira' } });
    await submit();
    expect(screen.getByText('Escolha o ambiente do produto.')).toBeTruthy();
    expect(saveProduct).not.toHaveBeenCalled();
  },
);

test('a list with no rooms offers management instead of an unusable product form', async () => {
  getList.mockResolvedValue({ ...LIST, rooms: [] });
  render(await newProductPage());
  expect(screen.queryByRole('button', { name: 'Salvar produto' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Gerenciar ambientes' }).getAttribute('href')).toBe(`/listas/${LIST.id}/ambientes`);
});

test.each(['0', '-2', '', '1.5', '1000'])('submitting with Enter rejects quantity %j without silently fixing it', async (qtd) => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: qtd } });
  fireEvent.blur(screen.getByLabelText('Quantidade'));
  await submit();
  expect(screen.getByLabelText('Quantidade').getAttribute('aria-invalid')).toBe('true');
  expect(saveProduct).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test.each(['1', '999'])('integer quantity %s is persisted', async (qtd) => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: qtd } });
  await submit();
  expect(saveProduct.mock.calls[0][2].quantity).toBe(Number(qtd));
});

test.each([
  ['1.234,56', 1234.56], ['0,00', 0], ['', null],
])('price %j survives blur and maps to %j', async (preco, expected) => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Preço unitário'), { target: { value: preco } });
  fireEvent.blur(screen.getByLabelText('Preço unitário'));
  await submit();
  expect(saveProduct.mock.calls[0][2].unitPrice).toBe(expected);
});

test.each(['-1,00', '1,234', 'abc', '10000000000', '1.23', '12x'])('invalid money %j is kept for correction and blocks saving', async (price) => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Preço unitário'), { target: { value: price } });
  fireEvent.blur(screen.getByLabelText('Preço unitário'));
  await submit();
  expect(screen.getByLabelText('Preço unitário').value).toBe(price);
  expect(screen.getByLabelText('Preço unitário').getAttribute('aria-invalid')).toBe('true');
  expect(saveProduct).not.toHaveBeenCalled();
});

test('the product form requires a name and persists a valid product back to its list', async () => {
  mount({ defaultRoomId: ROOM.id });
  await submit();
  expect(screen.getByText('Preencha este campo.')).toBeTruthy();
  expect(saveProduct).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira' } });
  await submit();
  expect(saveProduct).toHaveBeenCalledWith(LIST.id, null, {
    name: 'Batedeira', roomId: ROOM.id, quantity: 1, unitPrice: null, notes: null, bought: false, links: [],
  });
  expect(push).toHaveBeenCalledWith(`/listas/${LIST.id}`);
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([
  ['Nome do produto', 'n'.repeat(121)], ['Observações', 'n'.repeat(1001)],
])('over-limit %s blocks saving', async (label, value) => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
  await submit();
  expect(screen.getByLabelText(new RegExp(label)).getAttribute('aria-invalid')).toBe('true');
  expect(saveProduct).not.toHaveBeenCalled();
});

test('exact product name and notes limits still save', async () => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'n'.repeat(120) } });
  fireEvent.change(screen.getByLabelText(/Observações/), { target: { value: 'o'.repeat(1000) } });
  await submit();
  expect(saveProduct).toHaveBeenCalledWith(LIST.id, null, expect.objectContaining({
    name: 'n'.repeat(120), notes: 'o'.repeat(1000),
  }));
});

test('changing purchase status persists the selected bought value', async () => {
  mount();
  fillNew();
  fireEvent.click(screen.getByRole('radio', { name: 'Comprado' }));
  await submit();
  expect(saveProduct).toHaveBeenCalledWith(LIST.id, null, expect.objectContaining({ bought: true }));
});

test.each([
  ['https://loja.com oferta', false], ['https://loja.com/oferta', true],
])('the purchase link %j is accepted: %s', async (link, saved) => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Link da loja'), { target: { value: link } });
  await submit();
  expect(saveProduct).toHaveBeenCalledTimes(saved ? 1 : 0);
  expect(push).toHaveBeenCalledTimes(saved ? 1 : 0);
});

test('note-only rows show URL errors under the visible input before saving', async () => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Observação do link'), { target: { value: 'Azul' } });
  await submit();
  const input = screen.getByLabelText('Link da loja');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Cole o link completo, começando com https://');
  expect(document.activeElement).toBe(input);
  expect(saveProduct).not.toHaveBeenCalled();
});

test('too many links focuses the links container and does not save', async () => {
  mount({ product: { ...PRODUCT, links: Array.from({ length: 11 }, () => ({ url: 'https://loja.com', note: null })) } });
  await submit();
  expect(screen.getByText('Adicione no máximo 10 links.')).toBeTruthy();
  expect(document.activeElement.id).toBe('links');
  expect(saveProduct).not.toHaveBeenCalled();
});

test('a compact API link error attaches to the correct stable row and clears on editing that input', async () => {
  mount();
  fillNew();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra opção de loja' }));
  fireEvent.change(screen.getAllByLabelText('Link da loja')[1], { target: { value: 'https://loja.com' } });
  saveProduct.mockResolvedValue({ ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { 'links[0].url': 'Link rejeitado pela API.' } });
  await submit();
  const inputs = screen.getAllByLabelText('Link da loja');
  expect(inputs[0].getAttribute('aria-invalid')).toBe('false');
  expect(inputs[1].id).toBe('link-row1-url');
  expect(inputs[1].getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(inputs[1].getAttribute('aria-describedby')).textContent).toBe('Link rejeitado pela API.');
  fireEvent.change(inputs[1], { target: { value: 'https://outra.com' } });
  expect(screen.queryByText('Link rejeitado pela API.')).toBeNull();
});

test('removing a row then adding another never reuses the old input ID', () => {
  mount();
  const firstId = screen.getByLabelText('Link da loja').id;
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra opção de loja' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Remover link' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra opção de loja' }));
  expect(screen.getAllByLabelText('Link da loja').map((input) => input.id)).toEqual(['link-row1-url', 'link-row2-url']);
  expect(screen.getAllByLabelText('Link da loja').map((input) => input.id)).not.toContain(firstId);
});

test('link errors use submitted compact indices even if a blank row is filled during the request', async () => {
  mount();
  fillNew();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra opção de loja' }));
  fireEvent.change(screen.getAllByLabelText('Link da loja')[1], { target: { value: 'https://loja.com' } });
  const saving = deferred();
  saveProduct.mockReturnValueOnce(saving.promise);
  await submit();
  fireEvent.change(screen.getAllByLabelText('Link da loja')[0], { target: { value: 'https://outra.com' } });
  await act(async () => { saving.resolve({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { 'links[0].url': 'Link rejeitado pela API.' },
  }); });
  const inputs = screen.getAllByLabelText('Link da loja');
  expect(inputs[0].getAttribute('aria-invalid')).toBe('false');
  expect(inputs[1].getAttribute('aria-invalid')).toBe('true');
  expect(inputs[1].value).toBe('https://loja.com');
  expect(push).not.toHaveBeenCalled();
});

test('editing shows API values, object links, image path and bought state without changing them on save', async () => {
  getList.mockResolvedValue({ ...LIST, rooms: [{ ...ROOM, products: [{ ...PRODUCT, imageUrl: IMAGE_URL, bought: true }] }] });
  render(await editProductPage());
  expect(screen.getByLabelText('Nome do produto').value).toBe('Batedeira');
  expect(screen.getByLabelText('Ambiente').value).toBe(ROOM.id);
  expect(screen.getByLabelText('Quantidade').value).toBe('2');
  expect(screen.getByLabelText(/Observações/).value).toBe('Conferir as medidas.');
  expect(screen.getByLabelText('Link da loja').value).toBe('https://example.com/batedeira');
  expect(screen.getByRole('radio', { name: 'Comprado' }).checked).toBe(true);
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe(LOCAL_IMAGE_URL);
  await submit();
  expect(saveProduct.mock.calls[0][1]).toBe(PRODUCT.id);
  expect(saveProduct.mock.calls[0][2]).toEqual({
    name: PRODUCT.name, roomId: ROOM.id, quantity: 2, unitPrice: 12.5, notes: PRODUCT.notes, bought: true, links: PRODUCT.links,
  });
  expect(uploadProductImage).not.toHaveBeenCalled();
  expect(deleteProductImage).not.toHaveBeenCalled();
});

test.each([
  ['a GIF', new File(['x'], 'foto.gif', { type: 'image/gif' })],
  ['a PNG over 5MiB', new File([new Uint8Array(MAX_BYTES + 1)], 'foto.png', { type: 'image/png' })],
])('the image picker rejects %s without preparing an upload', async (_, file) => {
  mount();
  fillNew();
  pick(file);
  expect(createUrl).not.toHaveBeenCalled();
  await submit();
  expect(uploadProductImage).not.toHaveBeenCalled();
});

test.each(['image/jpeg', 'image/png'])('the picker accepts an exact 5MiB %s file', (type) => {
  mount();
  const file = pick(new File([new Uint8Array(MAX_BYTES)], 'foto', { type }));
  expect(createUrl).toHaveBeenCalledWith(file);
});

test('preview object URLs belong to the selected file and are released on replace, removal and unmount', () => {
  const view = mount();
  createUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second').mockReturnValueOnce('blob:third');
  pick();
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe('blob:first');
  pick(new File(['jpg'], 'foto.jpg', { type: 'image/jpeg' }));
  expect(revokeUrl).toHaveBeenCalledWith('blob:first');
  expect(revokeUrl).not.toHaveBeenCalledWith('blob:second');
  fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }));
  expect(revokeUrl).toHaveBeenCalledWith('blob:second');
  pick();
  view.unmount();
  expect(revokeUrl).toHaveBeenCalledWith('blob:third');
});

test('JSON saving completes before multipart upload and a pending submit cannot create twice', async () => {
  mount();
  fillNew();
  const file = pick();
  const saving = deferred();
  const uploading = deferred();
  saveProduct.mockReturnValueOnce(saving.promise);
  uploadProductImage.mockReturnValueOnce(uploading.promise);
  const form = screen.getByRole('button', { name: 'Salvar produto' }).closest('form');
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(saveProduct).toHaveBeenCalledOnce();
  expect(uploadProductImage).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  await act(async () => { saving.resolve({ ok: true, data: PRODUCT }); });
  expect(uploadProductImage).toHaveBeenCalledOnce();
  expect(uploadProductImage.mock.calls[0].slice(0, 2)).toEqual([LIST.id, PRODUCT.id]);
  expect(uploadProductImage.mock.calls[0][2].get('file')).toBe(file);
  expect(push).not.toHaveBeenCalled();
  await act(async () => { uploading.resolve({ ok: true, data: { imageUrl: IMAGE_URL } }); });
  expect(push).toHaveBeenCalledExactlyOnceWith(`/listas/${LIST.id}`);
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe(LOCAL_IMAGE_URL);
  expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
});

test('a failed JSON save retains the selected file and never uploads it', async () => {
  mount();
  fillNew();
  pick();
  saveProduct.mockResolvedValueOnce({ ok: false, status: 400, detail: 'Nome rejeitado.', errors: { name: 'Nome rejeitado.' } });
  await submit();
  expect(uploadProductImage).not.toHaveBeenCalled();
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe('blob:preview');
  expect(screen.queryByText(PARTIAL_COPY)).toBeNull();
  expect(push).not.toHaveBeenCalled();
});

test('an image failure after create retains saved UUID, file and later edits without a second POST', async () => {
  mount();
  fillNew();
  const file = pick();
  uploadProductImage.mockResolvedValueOnce({ ok: false, status: 503, detail: 'Falha no envio.', errors: {} });
  await submit();
  expect(saveProduct).toHaveBeenCalledOnce();
  expect(saveProduct.mock.calls[0][1]).toBeNull();
  expect(screen.getByText(PARTIAL_COPY)).toBeTruthy();
  expect(screen.getByText('Falha no envio.')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe('blob:preview');
  expect(push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira azul' } });
  await submit();
  expect(saveProduct.mock.calls[1][1]).toBe(PRODUCT.id);
  expect(saveProduct.mock.calls[1][2].name).toBe('Batedeira azul');
  expect(uploadProductImage).toHaveBeenCalledTimes(2);
  expect(uploadProductImage.mock.calls[1][2].get('file')).toBe(file);
  expect(push).toHaveBeenCalledOnce();
  expect(screen.queryByText(PARTIAL_COPY)).toBeNull();
});

test('failed removal preserves image removal intent until the next DELETE succeeds', async () => {
  mount({ product: { ...PRODUCT, imageUrl: IMAGE_URL } });
  fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }));
  deleteProductImage.mockResolvedValueOnce({ ok: false, status: 503, detail: 'Falha ao remover.', errors: {} });
  await submit();
  expect(deleteProductImage).toHaveBeenCalledWith(LIST.id, PRODUCT.id);
  expect(screen.getByText(PARTIAL_COPY)).toBeTruthy();
  expect(screen.getByText('Falha ao remover.')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(push).not.toHaveBeenCalled();
  await submit();
  expect(deleteProductImage).toHaveBeenCalledTimes(2);
  expect(uploadProductImage).not.toHaveBeenCalled();
  expect(push).toHaveBeenCalledOnce();
});

test('leaving while an image is pending releases the preview and suppresses completion navigation', async () => {
  const view = mount();
  fillNew();
  pick();
  const uploading = deferred();
  uploadProductImage.mockReturnValueOnce(uploading.promise);
  await submit();
  expect(uploadProductImage).toHaveBeenCalledOnce();
  view.unmount();
  expect(revokeUrl).toHaveBeenCalledWith('blob:preview');
  await act(async () => { uploading.resolve({ ok: true, data: { imageUrl: IMAGE_URL } }); });
  expect(push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('deleting a product waits for confirmation and API success; a failure stays on the form', async () => {
  mount({ product: PRODUCT });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir produto' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
  expect(deleteProduct).not.toHaveBeenCalled();
  const deletion = deferred();
  deleteProduct.mockReturnValueOnce(deletion.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir produto' }));
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir produto' })); });
  expect(deleteProduct).toHaveBeenCalledWith(LIST.id, PRODUCT.id);
  expect(push).not.toHaveBeenCalled();
  await act(async () => { deletion.resolve({ ok: false, status: 503, detail: 'Não foi possível excluir.', errors: {} }); });
  expect(screen.getByText('Não foi possível excluir.')).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir produto' }));
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir produto' })); });
  expect(push).toHaveBeenCalledWith(`/listas/${LIST.id}`);
});
