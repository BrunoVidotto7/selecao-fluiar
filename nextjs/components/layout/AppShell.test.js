import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AppShell from './AppShell';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

beforeEach(() => {
  window.matchMedia = (query) => ({ matches: query === '(max-width: 960px)' });
});

function openDrawer() {
  render(<AppShell><button type="button">Conteúdo da página</button></AppShell>);
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
  const logout = screen.getByRole('link', { name: 'Sair' });

  logout.focus();
  fireEvent.keyDown(logout, { key: 'Tab' });
  expect(document.activeElement).toBe(close);

  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(logout);
});

test('on desktop the sidebar is ordinary navigation and does not hold the focus', () => {
  openDrawer();
  window.matchMedia = () => ({ matches: false });
  const logout = screen.getByRole('link', { name: 'Sair' });

  logout.focus();
  const event = fireEvent.keyDown(logout, { key: 'Tab' });
  expect(event).toBe(true);
  expect(document.activeElement).toBe(logout);
});
