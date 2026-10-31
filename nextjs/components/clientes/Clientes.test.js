import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ClientsPage from '@/app/(app)/clientes/page';
import ClientPage from '@/app/(app)/clientes/[id]/page';
import { FeedbackProvider } from '../feedback/Feedback';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/clientes', notFound: vi.fn() }));

const clientPage = async (id, query = {}) => ClientPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) });

test('deleting the last list card updates the count, the empty state and the client delete warning', async () => {
  render(<FeedbackProvider>{await clientPage('marina-duarte')}</FeedbackProvider>);
  expect(screen.getByRole('heading', { name: /Listas de compras · 1/ })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Excluir Home office' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));

  expect(screen.getByRole('heading', { name: 'Listas de compras' })).toBeTruthy();
  expect(screen.getByText('Marina ainda não tem listas')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(screen.getByText('Essa ação não pode ser desfeita.')).toBeTruthy();
  expect(screen.queryByText(/também será excluída/)).toBeNull();
});

const page = (Page, query) => Page({ searchParams: Promise.resolve(query) });
const EMPTY = 'Nenhum cliente por aqui ainda';

test('the clients page follows the empty-state query when only the query changes', async () => {
  const view = render(await page(ClientsPage, {}));
  expect(screen.getByRole('link', { name: 'Sérgio Hooper' })).toBeTruthy();

  view.rerender(await page(ClientsPage, { estado: 'vazio' }));
  expect(screen.getByText(EMPTY)).toBeTruthy();

  view.rerender(await page(ClientsPage, {}));
  expect(screen.queryByText(EMPTY)).toBeNull();
});
