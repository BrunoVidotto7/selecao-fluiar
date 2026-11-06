import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ProductForm from './ProductForm';
import NewProductPage from '@/app/(app)/(admin)/listas/[id]/produtos/novo/page';
import EditProductPage from '@/app/(app)/(admin)/listas/[id]/produtos/[produtoId]/editar/page';
import { FeedbackProvider } from '../feedback/Feedback';
import { LIST, ROOM, PRODUCT, SECOND_ROOM, CATEGORIES } from '@/test-support/fixtures';
import { saveProduct, uploadProductImage, deleteProductImage, deleteProduct, findProductImages, uploadProductImageFromUrl, previewStoreProduct } from './actions';
import { getList } from '../listas/queries.server';
import { readApi } from '@/lib/api.server';
import { QUANTITY_AREA_INVALID, QUANTITY_UNIT_INVALID } from '@/lib/validation';

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
  findProductImages: vi.fn(), uploadProductImageFromUrl: vi.fn(), previewStoreProduct: vi.fn(),
}));
vi.mock('../listas/queries.server', () => ({ getList: vi.fn() }));
vi.mock('@/lib/api.server', () => ({ readApi: vi.fn() }));

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
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[0].id } });
};
const submit = async () => {
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Salvar produto' }).closest('form')); });
};
const pick = (file = new File(['png'], 'foto.png', { type: 'image/png' })) => {
  fireEvent.change(screen.getByLabelText(/Escolher imagem|Trocar imagem/), { target: { files: [file] } });
  return file;
};
const searchImages = async (link = 'https://loja.com/produto') => {
  fireEvent.change(screen.getByLabelText('Link da página do produto'), { target: { value: link } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buscar imagens' })); });
};
const mount = (props = {}) => render(<FeedbackProvider><ProductForm listId={LIST.id} rooms={[ROOM, SECOND_ROOM]} categories={CATEGORIES} {...props} /></FeedbackProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  saveProduct.mockReset().mockResolvedValue({ ok: true, data: PRODUCT });
  uploadProductImage.mockReset().mockResolvedValue({ ok: true, data: { imageUrl: IMAGE_URL } });
  deleteProductImage.mockReset().mockResolvedValue({ ok: true, data: undefined });
  deleteProduct.mockReset().mockResolvedValue({ ok: true, data: undefined });
  findProductImages.mockReset().mockResolvedValue({ ok: true, data: { images: [] } });
  uploadProductImageFromUrl.mockReset().mockResolvedValue({ ok: true, data: { imageUrl: IMAGE_URL } });
  getList.mockReset().mockResolvedValue(LIST);
  readApi.mockReset().mockResolvedValue(CATEGORIES);
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
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[0].id } });
  await submit();
  expect(saveProduct).toHaveBeenCalledWith(LIST.id, null, {
    name: 'Batedeira', roomId: ROOM.id, categoryId: CATEGORIES[0].id, quantity: 1, unit: 'UNIT', unitPrice: null, notes: null, bought: false, links: [],
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
    name: PRODUCT.name, roomId: ROOM.id, categoryId: PRODUCT.category.id, quantity: 2, unit: 'UNIT', unitPrice: 12.5, notes: PRODUCT.notes, bought: true, links: PRODUCT.links,
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

test('a store link offers its images and the chosen one is uploaded after the product is saved', async () => {
  mount();
  fillNew();
  findProductImages.mockResolvedValue({
    ok: true, data: { images: ['https://cdn.loja.com/a.jpg', 'https://cdn.loja.com/b.jpg'] },
  });
  await searchImages();
  expect(findProductImages).toHaveBeenCalledWith('https://loja.com/produto');
  const choices = screen.getAllByRole('button', { name: /Usar imagem/ });
  expect(choices).toHaveLength(2);
  fireEvent.click(choices[1]);
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe('https://cdn.loja.com/b.jpg');
  await submit();
  expect(saveProduct).toHaveBeenCalledOnce();
  expect(uploadProductImageFromUrl).toHaveBeenCalledWith(LIST.id, PRODUCT.id, 'https://cdn.loja.com/b.jpg');
  expect(uploadProductImage).not.toHaveBeenCalled();
  expect(push).toHaveBeenCalledExactlyOnceWith(`/listas/${LIST.id}`);
});

test('a store link without images explains it without blocking the rest of the form', async () => {
  mount();
  fillNew();
  findProductImages.mockResolvedValue({ ok: true, data: { images: [] } });
  await searchImages();
  expect(screen.getByText('Nenhuma imagem encontrada nesse link.')).toBeTruthy();
  await submit();
  expect(saveProduct).toHaveBeenCalledOnce();
  expect(uploadProductImageFromUrl).not.toHaveBeenCalled();
});

test('a failed image search shows why and can be retried', async () => {
  mount();
  findProductImages.mockResolvedValueOnce({
    ok: false, status: 502, detail: 'Não conseguimos abrir esse link. Verifique se ele está completo.', errors: {},
  });
  await searchImages();
  expect(screen.getByText('Não conseguimos abrir esse link. Verifique se ele está completo.')).toBeTruthy();
  findProductImages.mockResolvedValueOnce({ ok: true, data: { images: ['https://cdn.loja.com/a.jpg'] } });
  await searchImages();
  expect(screen.getAllByRole('button', { name: /Usar imagem/ })).toHaveLength(1);
  expect(screen.queryByText('Não conseguimos abrir esse link. Verifique se ele está completo.')).toBeNull();
});

test('an imported image failure keeps the choice for the next save without a second product POST', async () => {
  mount();
  fillNew();
  findProductImages.mockResolvedValue({ ok: true, data: { images: ['https://cdn.loja.com/a.jpg'] } });
  await searchImages();
  fireEvent.click(screen.getByRole('button', { name: 'Usar imagem 1' }));
  uploadProductImageFromUrl.mockResolvedValueOnce({ ok: false, status: 503, detail: 'Falha no envio.', errors: {} });
  await submit();
  expect(screen.getByText(PARTIAL_COPY)).toBeTruthy();
  expect(screen.getByText('Falha no envio.')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Prévia do produto' }).getAttribute('src')).toBe('https://cdn.loja.com/a.jpg');
  expect(push).not.toHaveBeenCalled();
  await submit();
  expect(saveProduct.mock.calls[1][1]).toBe(PRODUCT.id);
  expect(uploadProductImageFromUrl).toHaveBeenCalledTimes(2);
  expect(push).toHaveBeenCalledOnce();
  expect(screen.queryByText(PARTIAL_COPY)).toBeNull();
});

test('removing an imported image before saving skips the upload', async () => {
  mount();
  fillNew();
  findProductImages.mockResolvedValue({ ok: true, data: { images: ['https://cdn.loja.com/a.jpg'] } });
  await searchImages();
  fireEvent.click(screen.getByRole('button', { name: 'Usar imagem 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }));
  expect(screen.queryByRole('img', { name: 'Prévia do produto' })).toBeNull();
  await submit();
  expect(uploadProductImageFromUrl).not.toHaveBeenCalled();
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

const STORE_PREVIEW = { sourceUrl: 'https://moveca.com.br/products/chair', store: 'moveca', productId: 'chair', variantId: 'oak', variants: [], name: 'Cadeira', unitPrice: 1250, imageUrl: 'https://cdn.moveca.com.br/chair.png', resolution: 'resolved' };
const searchProduct = async () => {
  fireEvent.change(screen.getByLabelText('Link da página do produto'), { target: { value: STORE_PREVIEW.sourceUrl } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buscar produto' })); });
};
test('resolved product preview fills fields and saves an explicit binding without a second image write', async () => {
  previewStoreProduct.mockResolvedValue({ ok: true, data: STORE_PREVIEW });
  mount({ defaultRoomId: ROOM.id });
  await searchProduct();
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[0].id } });
  expect(screen.getByLabelText('Nome do produto').value).toBe('Cadeira');
  expect(screen.getByLabelText('Preço unitário').value).toBe('1.250,00');
  await submit();
  expect(saveProduct.mock.calls[0][2]).toMatchObject({ name: 'Cadeira', unitPrice: 1250, storeSync: { sourceUrl: STORE_PREVIEW.sourceUrl, variantId: 'oak' } });
  expect(uploadProductImageFromUrl).not.toHaveBeenCalled();
});
test('variant preview requires an explicit choice before binding', async () => {
  previewStoreProduct.mockResolvedValueOnce({ ok: true, data: { ...STORE_PREVIEW, resolution: 'variant_required', variants: [{ id: 'oak', label: 'Carvalho' }] } }).mockResolvedValueOnce({ ok: true, data: STORE_PREVIEW });
  mount({ defaultRoomId: ROOM.id });
  await searchProduct();
  expect(screen.getByLabelText('Versão do produto').value).toBe('');
  fireEvent.change(screen.getByLabelText('Versão do produto'), { target: { value: 'oak' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buscar produto' })); });
  expect(previewStoreProduct).toHaveBeenLastCalledWith(STORE_PREVIEW.sourceUrl, 'oak');
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[0].id } });
  await submit();
  expect(saveProduct.mock.calls[0][2].storeSync.variantId).toBe('oak');
});
test('manual edits require confirmation and disable the whole binding', async () => {
  mount({ product: { ...PRODUCT, storeSync: { ...STORE_PREVIEW, enabled: true, status: 'synced' } } });
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Meu nome' } });
  await submit();
  expect(saveProduct).not.toHaveBeenCalled();
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.textContent).toContain('desliga a atualização automática');
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar como manual' })); });
  expect(saveProduct.mock.calls[0][2].storeSync).toBeNull();
});
test('preview mismatch can be cancelled without saving or losing the draft', async () => {
  previewStoreProduct.mockResolvedValue({ ok: true, data: STORE_PREVIEW });
  mount({ defaultRoomId: ROOM.id });
  await searchProduct();
  fireEvent.change(screen.getByLabelText('Preço unitário'), { target: { value: '900,00' } });
  await submit();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
  expect(saveProduct).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Preço unitário').value).toBe('900,00');
});

test('removing the preview photo requires manual-save confirmation', async () => {
  previewStoreProduct.mockResolvedValue({ ok: true, data: STORE_PREVIEW });
  mount({ defaultRoomId: ROOM.id });
  await searchProduct();
  fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }));
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[0].id } });
  await submit();
  expect(saveProduct).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Salvar como manual' })); });
  expect(saveProduct.mock.calls[0][2].storeSync).toBeNull();
  expect(uploadProductImageFromUrl).not.toHaveBeenCalled();
});
test('editing the source URL invalidates an earlier preview binding', async () => {
  previewStoreProduct.mockResolvedValue({ ok: true, data: STORE_PREVIEW });
  mount({ defaultRoomId: ROOM.id });
  await searchProduct();
  fireEvent.change(screen.getByLabelText('Link da página do produto'), { target: { value: 'https://moveca.com.br/products/other' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[0].id } });
  await submit();
  expect(saveProduct.mock.calls[0][2]).not.toHaveProperty('storeSync');
});
test('quantity changes preserve an existing binding without confirmation', async () => {
  mount({ product: { ...PRODUCT, storeSync: { ...STORE_PREVIEW, enabled: true, status: 'ok' } } });
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
  await submit();
  expect(saveProduct.mock.calls[0][2]).not.toHaveProperty('storeSync');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
test('a manual photo on a linked product disables its binding before upload', async () => {
  mount({ product: { ...PRODUCT, storeSync: { ...STORE_PREVIEW, enabled: true, status: 'ok' } } });
  pick();
  await submit();
  expect(saveProduct).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Salvar como manual' })); });
  expect(saveProduct.mock.calls[0][2].storeSync).toBeNull();
  expect(uploadProductImage).toHaveBeenCalledOnce();
});
test('failed store preview leaves manual entry and image search available', async () => {
  previewStoreProduct.mockResolvedValue({ ok: false, status: 502, detail: 'Loja indisponível.', errors: {} });
  mount();
  fillNew();
  await searchProduct();
  expect(screen.getByText('Loja indisponível.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Buscar imagens' }).disabled).toBe(false);
  await submit();
  expect(saveProduct.mock.calls[0][2]).not.toHaveProperty('storeSync');
});
test('pending preview blocks save and unmount suppresses late results', async () => {
  const pending = deferred();
  previewStoreProduct.mockReturnValue(pending.promise);
  const view = mount();
  fillNew();
  await searchProduct();
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Salvando…' }).closest('form')); });
  expect(previewStoreProduct).toHaveBeenCalledTimes(1);
  expect(saveProduct).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => { pending.resolve({ ok: true, data: STORE_PREVIEW }); });
  expect(push).not.toHaveBeenCalled();
});

test('requires a category', async () => {
  mount();
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: 'Batedeira' } });
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: ROOM.id } });
  await submit();
  expect(screen.getByText('Escolha uma categoria.')).toBeTruthy();
  expect(saveProduct).not.toHaveBeenCalled();
});

test('offers active categories in order with no default', () => {
  mount();
  const select = screen.getByLabelText('Categoria');
  expect(select.value).toBe('');
  expect([...select.options].map((option) => option.textContent)).toEqual(['Selecione', 'Eletrodomésticos', 'Luminotécnica']);
});

test('keeps a deleted current category', async () => {
  const product = { ...PRODUCT, category: { id: 'x', name: 'Pedras', deleted: true } };
  mount({ product });
  const select = screen.getByLabelText('Categoria');
  expect(select.value).toBe('x');
  expect(select.selectedOptions[0].textContent).toBe('Pedras (removida)');
  await submit();
  expect(saveProduct.mock.calls[0][2].categoryId).toBe('x');
});

test('sends the chosen category', async () => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: CATEGORIES[1].id } });
  await submit();
  expect(saveProduct.mock.calls[0][2].categoryId).toBe(CATEGORIES[1].id);
});

test('the store preview leaves the category empty and required', async () => {
  previewStoreProduct.mockResolvedValue({ ok: true, data: { resolution: 'resolved', name: 'Importado', unitPrice: 10, imageUrl: null, sourceUrl: 'https://loja.com/p', variantId: null } });
  mount();
  fireEvent.change(screen.getByLabelText('Link da página do produto'), { target: { value: 'https://loja.com/p' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buscar produto' })); });
  expect(screen.getByLabelText('Nome do produto').value).toBe('Importado');
  expect(screen.getByLabelText('Categoria').value).toBe('');
  fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: ROOM.id } });
  await submit();
  expect(screen.getByText('Escolha uma categoria.')).toBeTruthy();
  expect(saveProduct).not.toHaveBeenCalled();
});

test('the product pages load the office categories', async () => {
  const view = render(await newProductPage());
  expect(readApi).toHaveBeenCalledWith('/api/office/categories');
  expect(screen.getByRole('option', { name: 'Luminotécnica' })).toBeTruthy();
  view.unmount();
  render(await editProductPage());
  expect(screen.getByLabelText('Categoria').value).toBe(PRODUCT.category.id);
});

const QUANTITY_UNIT_INVALID_TEXT = QUANTITY_UNIT_INVALID;

test('the unit selector starts at Unidades and square meters accept a decimal quantity', async () => {
  mount();
  fillNew();
  expect(screen.getByLabelText('Unidade').value).toBe('UNIT');
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'SQUARE_METER' } });
  expect(screen.queryByRole('button', { name: 'Aumentar' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '12,5' } });
  await submit();
  expect(saveProduct.mock.calls[0][2]).toMatchObject({ quantity: 12.5, unit: 'SQUARE_METER' });
});

test('switching back to Unidades revalidates a decimal quantity and blocks saving', async () => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'SQUARE_METER' } });
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '12,5' } });
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'UNIT' } });
  expect(screen.getByText(QUANTITY_UNIT_INVALID_TEXT)).toBeTruthy();
  expect(screen.getByLabelText('Quantidade').value).toBe('12,5');
  expect(screen.getByLabelText('Quantidade').type).toBe('text');
  await submit();
  expect(saveProduct).not.toHaveBeenCalled();
});

test('the stepper always yields an integer after switching back from a decimal', () => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'SQUARE_METER' } });
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '12,5' } });
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'UNIT' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar' }));
  expect(screen.getByLabelText('Quantidade').value).toBe('13');
});

test('a dot decimal is rejected for square meters', async () => {
  mount();
  fillNew();
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'SQUARE_METER' } });
  fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '12.5' } });
  await submit();
  expect(screen.getByText(QUANTITY_AREA_INVALID)).toBeTruthy();
  expect(saveProduct).not.toHaveBeenCalled();
});

test('an existing square meter product opens with its unit and pt-BR quantity', () => {
  mount({ product: { ...PRODUCT, unit: 'SQUARE_METER', quantity: 12.5 } });
  expect(screen.getByLabelText('Unidade').value).toBe('SQUARE_METER');
  expect(screen.getByLabelText('Quantidade').value).toBe('12,5');
});
