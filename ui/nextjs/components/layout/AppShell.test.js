import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AppShell from './AppShell';
import { ME } from '@/test-support/fixtures';
import { logout } from '../auth/actions';

const { route } = vi.hoisted(() => ({ route: { pathname: '/dashboard' } }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('../auth/actions', () => ({ logout: vi.fn() }));

beforeEach(() => {
  route.pathname = '/dashboard';
  logout.mockReset().mockResolvedValue(undefined);
  window.matchMedia = (query) => ({ matches: query === '(max-width: 960px)' });
});

function openDrawer() {
  render(<AppShell user={ME}><button type="button">Conteúdo da página</button></AppShell>);
  const openButton = screen.getByRole('button', { name: 'Abrir menu' });
  openButton.focus();
  fireEvent.click(openButton);
  return openButton;
}

test('opening the drawer focuses the first navigation link', () => {
  openDrawer();
  expect(screen.getByRole('button', { name: 'Abrir menu' }).getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Dashboard' }));
});

test('Escape closes the drawer and returns focus to the menu button', () => {
  const openButton = openDrawer();
  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  expect(openButton.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(openButton);
});

test('Tab and Shift+Tab keep the focus inside the open mobile drawer', () => {
  openDrawer();
  const close = screen.getByRole('button', { name: 'Fechar menu' });
  const logout = screen.getByRole('button', { name: 'Sair' });

  logout.focus();
  fireEvent.keyDown(logout, { key: 'Tab' });
  expect(document.activeElement).toBe(close);

  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(logout);
});

test('on desktop the sidebar is ordinary navigation and does not hold the focus', () => {
  openDrawer();
  window.matchMedia = () => ({ matches: false });
  const logout = screen.getByRole('button', { name: 'Sair' });

  logout.focus();
  const event = fireEvent.keyDown(logout, { key: 'Tab' });
  expect(event).toBe(true);
  expect(document.activeElement).toBe(logout);
});

test('the shell shows the authenticated name, initials and real office instead of a fake role', () => {
  render(<AppShell user={ME}>Conteúdo da página</AppShell>);
  expect(screen.getByText('Ana Lima')).toBeTruthy();
  expect(screen.getByText('AL')).toBeTruthy();
  expect(screen.getByText('Escritório de Ana Lima')).toBeTruthy();
  expect(screen.queryByText('Paula Hooper')).toBeNull();
  expect(screen.queryByText(/Arquiteta/)).toBeNull();
  expect(screen.getByRole('main').textContent).toBe('Conteúdo da página');
});

test('office navigation is available and active on the office management route', () => {
  route.pathname = '/escritorio';
  const view = render(<AppShell user={ME}>Conteúdo da página</AppShell>);
  const link = screen.queryByRole('link', { name: 'Escritório' });
  expect(link).toBeTruthy();
  expect(link.getAttribute('href')).toBe('/escritorio');
  expect(link.getAttribute('aria-current')).toBe('page');
  view.rerender(<AppShell user={{ ...ME, officeName: 'Ateliê Ana' }}>Conteúdo da página</AppShell>);
  expect(screen.getByText('Ateliê Ana')).toBeTruthy();
  expect(screen.queryByText('Escritório de Ana Lima')).toBeNull();
});

test('Sair submits the logout command rather than merely navigating to login', async () => {
  render(<AppShell user={ME}>Conteúdo da página</AppShell>);
  const button = screen.getByRole('button', { name: 'Sair' });
  expect(screen.queryByRole('link', { name: 'Sair' })).toBeNull();
  await act(async () => { fireEvent.click(button); });
  expect(logout).toHaveBeenCalledOnce();
});

test('a route change closes the drawer and updates the active navigation', () => {
  const view = render(<AppShell user={ME}>Conteúdo da página</AppShell>);
  const button = screen.getByRole('button', { name: 'Abrir menu' });
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  route.pathname = '/clientes';
  view.rerender(<AppShell user={ME}>Conteúdo da página</AppShell>);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByRole('link', { name: 'Clientes' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
});

test('unmounting an open drawer removes its focus trap', () => {
  const view = render(<><AppShell user={ME}>Conteúdo da página</AppShell><button>Fora da gaveta</button></>);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
  const outside = screen.getByRole('button', { name: 'Fora da gaveta' });
  outside.focus();
  expect(fireEvent.keyDown(outside, { key: 'Tab' })).toBe(false);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar menu' }));
  view.rerender(<button>Fora da gaveta</button>);
  const remaining = screen.getByRole('button', { name: 'Fora da gaveta' });
  remaining.focus();
  expect(fireEvent.keyDown(remaining, { key: 'Tab' })).toBe(true);
  expect(document.activeElement).toBe(remaining);
});
