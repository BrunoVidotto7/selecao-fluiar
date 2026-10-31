import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import Home from './page';
import NotFound from './not-found';
import ClientPage from './(app)/clientes/[id]/page';
import ListPage from './(app)/listas/[id]/page';
import EditProductPage from './(app)/listas/[id]/produtos/[produtoId]/editar/page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  useRouter: () => ({ push: vi.fn() }),
}));

const props = (params) => ({ params: Promise.resolve(params), searchParams: Promise.resolve({}) });

test('the root page redirects to the login screen', () => {
  Home();
  expect(redirect).toHaveBeenCalledWith('/login');
});

test('the not-found page explains the problem and links to the dashboard', () => {
  render(<NotFound />);
  expect(screen.getByText('Página não encontrada')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ir para o Dashboard' }).getAttribute('href')).toBe('/dashboard');
});

test.each([
  ['client', ClientPage, { id: 'inexistente' }],
  ['list', ListPage, { id: 'inexistente' }],
  ['product', EditProductPage, { id: 'lista-da-casa', produtoId: 'inexistente' }],
])('an unknown %s id shows the not-found page', async (_, Page, params) => {
  await expect(Page(props(params))).rejects.toThrow('NEXT_NOT_FOUND');
});
