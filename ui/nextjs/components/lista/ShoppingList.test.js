import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ShoppingList from './ShoppingList';
import ClientView from './ClientView';
import { ListNote, ListSignature } from './ListFooter';
import { LIST, OFFICE, PRODUCT, PUBLIC_LIST, ROOM, SECOND_PRODUCT, SECOND_ROOM } from '@/test-support/fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080'));
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
const renderFull = () => render(<ShoppingList list={fullList} signature={signature} />);
const summary = (container) => container.querySelector('.summary')?.textContent || '';
const EMPTY = 'Esta lista ainda não tem produtos';

test('the API room products render quantities and the persisted estimated and remaining totals', () => {
  const { container } = renderFull();
  expect(summary(container)).toMatch(/Itens3Comprados1Pendentes2Estimado R\$\s40,00 · faltam R\$\s35,00/);
  expect(screen.getAllByLabelText('Quantidade').map((input) => input.value)).toEqual(['2', '1', '1']);
  expect(screen.getByRole('link', { name: 'Batedeira' }).getAttribute('href'))
    .toBe(`/listas/${LIST.id}/produtos/${PRODUCT.id}/editar`);
  expect(screen.getByText(/2 × R\$\s10,00/)).toBeTruthy();
});

test('marking a product as bought and changing quantity retain the local behavior until Task 8', () => {
  const { container } = renderFull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Comprado: Batedeira' }));
  expect(summary(container)).toMatch(/Comprados2Pendentes1Estimado R\$\s40,00 · faltam R\$\s15,00/);
  const qty = screen.getAllByLabelText('Quantidade')[0];
  fireEvent.change(qty, { target: { value: '3' } });
  fireEvent.blur(qty);
  expect(summary(container)).toMatch(/Estimado R\$\s50,00/);
});

test.each([['blur'], ['Enter']])('an inline quantity below 1 is corrected to 1 on %s', (how) => {
  const { container } = renderFull();
  const qty = screen.getAllByLabelText('Quantidade')[0];
  fireEvent.change(qty, { target: { value: '0.5' } });
  if (how === 'blur') fireEvent.blur(qty);
  else { qty.focus(); fireEvent.keyDown(qty, { key: 'Enter' }); }
  expect(qty.value).toBe('1');
  expect(summary(container)).toMatch(/Estimado R\$\s30,00/);
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

test('the client view is read-only and keeps the API store links and notes', () => {
  renderFull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.queryByRole('link', { name: 'Editar Batedeira' })).toBeNull();
  expect(screen.getByText('Opção leve')).toBeTruthy();
  expect(screen.getByRole('link', { name: /loja.com.br/ }).getAttribute('href')).toBe('https://loja.com.br/varal');
  expect(screen.queryByText(PRODUCT.notes)).toBeNull();
});

test('read-only tables accept the public API subset without fabricated identifiers', () => {
  const rooms = [{
    name: 'Cozinha', products: [{
      name: 'Batedeira', quantity: 2, bought: false,
      links: [{ url: 'https://loja.com/item', note: 'Azul' }],
    }],
  }];
  render(<ClientView rooms={rooms} />);
  expect(screen.queryByText('2')).not.toBeNull();
  expect(screen.queryByRole('link', { name: /loja.com/ })?.getAttribute('href')).toBe('https://loja.com/item');
  expect(screen.getByText('Azul')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

test('public rows are immutable read-only displays even when names repeat', () => {
  const duplicateRoom = { ...PUBLIC_LIST.rooms[0], products: [PUBLIC_LIST.rooms[0].products[0], {
    ...PUBLIC_LIST.rooms[0].products[0], quantity: 3, bought: true,
  }] };
  render(<ClientView rooms={[duplicateRoom, duplicateRoom, { name: 'Vazio', products: [] }]} />);
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
});

test('API image paths use the origin helper and null prices remain Sem preço', () => {
  const product = { ...PRODUCT, imageUrl: '/api/images/' + PRODUCT.id, unitPrice: null };
  const { container } = render(<ShoppingList list={{
    ...LIST, rooms: [{ ...ROOM, products: [product] }],
    stats: { ...LIST.stats, estimatedTotal: 0, remainingTotal: 0 },
  }} signature={signature} />);
  expect(container.querySelector('img')?.getAttribute('src')).toBe('http://localhost:8080/api/images/' + PRODUCT.id);
  expect(screen.queryByText('Sem preço')).not.toBeNull();
  expect(container.querySelector('.price')?.textContent).not.toContain('0,00');
});

test('the two-step remove button names the product and the pending confirmation', () => {
  render(<ShoppingList list={LIST} signature={signature} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remover Batedeira' }));
  expect(screen.getByRole('button', { name: 'Confirmar remoção de Batedeira' })).toBeTruthy();
});

test('removing the last product shows the empty list state in both modes', () => {
  render(<ShoppingList list={LIST} signature={signature} />);
  const remove = screen.getByRole('button', { name: 'Remover Batedeira' });
  fireEvent.click(remove);
  fireEvent.click(remove);
  expect(screen.getByText(EMPTY)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ver como cliente' }));
  expect(screen.getByText(EMPTY)).toBeTruthy();
});

test('a real empty API list has its empty state and can display only real signature text', () => {
  render(<ShoppingList list={{
    ...LIST, rooms: [], stats: { totalProducts: 0, boughtProducts: 0, pendingProducts: 0, estimatedTotal: 0, remainingTotal: 0 },
  }} signature={signature} />);
  expect(screen.queryByText(EMPTY)).not.toBeNull();
  expect(screen.queryByRole('link', { name: 'Adicionar primeiro produto' })?.getAttribute('href'))
    .toBe('/listas/' + LIST.id + '/produtos/novo');
  expect(screen.getByText('Bruna Reis')).toBeTruthy();
});
