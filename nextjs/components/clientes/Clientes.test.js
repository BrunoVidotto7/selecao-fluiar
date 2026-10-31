import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientsPage from '@/app/(app)/clientes/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

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
