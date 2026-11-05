import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import ShareControls from './ShareControls';
import { rotateShareToken } from './actions';
import { FeedbackProvider } from '../feedback/Feedback';
import { LIST } from '@/test-support/fixtures';

const { refresh, clipboard } = vi.hoisted(() => ({ refresh: vi.fn(), clipboard: { writeText: vi.fn() } }));
vi.mock('next/navigation', async (importOriginal) => ({
  unstable_rethrow: (await importOriginal()).unstable_rethrow,
  useRouter: () => ({ refresh }), usePathname: () => '/listas/' + LIST.id,
}));
vi.mock('./actions', () => ({ rotateShareToken: vi.fn() }));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const viewOf = (props = {}) => (
  <FeedbackProvider><ShareControls listId={LIST.id} shareToken={LIST.shareToken} {...props} /></FeedbackProvider>
);
const linkField = () => screen.getByRole('textbox', { name: 'Link da lista' });
const copy = () => fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
const requestRotation = () => fireEvent.click(screen.getByRole('button', { name: 'Gerar novo link' }));
const confirmRotation = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Gerar novo link' }));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  clipboard.writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: clipboard, configurable: true } }));
  rotateShareToken.mockReset().mockResolvedValue({ ok: true, data: { shareToken: 'b'.repeat(43) } });
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

test('copying an existing share token never rotates it', async () => {
  render(viewOf());
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(window.location.origin + '/l/' + LIST.shareToken);
  expect(linkField().value).toBe(window.location.origin + '/l/' + LIST.shareToken);
  expect(screen.getByRole('status').textContent).toContain('Link copiado.');
  expect(rotateShareToken).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test('the initial render does not need a browser origin', () => {
  vi.stubGlobal('window', undefined);
  const html = renderToStaticMarkup(<ShareControls listId={LIST.id} shareToken={LIST.shareToken} />);
  expect(html).toContain('/l/' + LIST.shareToken);
  expect(html).toContain('Copiar link');
});

test('rotation requires an explicit old-link warning and cancellation does not write', () => {
  render(viewOf());
  requestRotation();
  expect(screen.getByRole('alertdialog').textContent).toMatch(/link anterior deixará de funcionar/i);
  expect(rotateShareToken).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(rotateShareToken).not.toHaveBeenCalled();
  expect(linkField().value).toContain(LIST.shareToken);
});

test('rotation stays pending once and changes the displayed and copied token only after success', async () => {
  const write = deferred();
  rotateShareToken.mockReturnValue(write.promise);
  render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  expect(rotateShareToken).toHaveBeenCalledExactlyOnceWith(LIST.id);
  requestRotation();
  copy();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Copiar link' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Gerar novo link' }).disabled).toBe(true);
  expect(linkField().value).toContain(LIST.shareToken);
  expect(clipboard.writeText).not.toHaveBeenCalled();
  expect(screen.queryByText('Novo link gerado. O link anterior deixou de funcionar.')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => write.resolve({ ok: true, data: { shareToken: 'b'.repeat(43) } }));
  expect(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain('Novo link gerado.');
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(rotateShareToken).toHaveBeenCalledOnce();
});

test('returned tokens survive stale props until acknowledgment, then later server tokens take ownership', async () => {
  const view = render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  view.rerender(viewOf());
  expect(linkField().value).toContain('b'.repeat(43));
  view.rerender(viewOf({ shareToken: 'b'.repeat(43) }));
  view.rerender(viewOf({ shareToken: 'c'.repeat(43) }));
  await act(async () => copy());
  expect(linkField().value).toContain('c'.repeat(43));
  expect(clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + 'c'.repeat(43));
});

test.each([
  ['failure', 'Não foi possível alterar o link.'],
  ['rejection', 'Não conseguimos gerar um novo link. Tente novamente.'],
])('a second rotation %s preserves the unacknowledged confirmed token for display and copy', async (outcome, detail) => {
  const secondWrite = deferred();
  rotateShareToken.mockResolvedValueOnce({ ok: true, data: { shareToken: 'b'.repeat(43) } })
    .mockReturnValueOnce(secondWrite.promise);
  const view = render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  view.rerender(viewOf());
  expect(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(refresh).toHaveBeenCalledOnce();

  requestRotation();
  await act(async () => confirmRotation());
  expect(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(screen.getByRole('button', { name: 'Copiar link' }).disabled).toBe(true);
  await act(async () => {
    if (outcome === 'failure') secondWrite.resolve({ ok: false, status: 503, detail, errors: {} });
    else secondWrite.reject(new Error('second rotation disconnected'));
  });
  view.rerender(viewOf());
  expect.soft(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));
  await act(async () => copy());
  expect.soft(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(screen.getByRole('status').textContent).toContain(detail);
  expect(screen.getAllByText('Novo link gerado. O link anterior deixou de funcionar.')).toHaveLength(1);
  expect(rotateShareToken.mock.calls).toEqual([[LIST.id], [LIST.id]]);
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([
  ['failure', 'Não foi possível alterar o link.'],
  ['rejection', 'Não conseguimos gerar um novo link. Tente novamente.'],
])('acknowledgment while confirmation is open lets refreshed props own the link after %s', async (outcome, detail) => {
  const secondWrite = deferred();
  rotateShareToken.mockResolvedValueOnce({ ok: true, data: { shareToken: 'b'.repeat(43) } })
    .mockReturnValueOnce(secondWrite.promise);
  const view = render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  expect(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));

  requestRotation();
  const dialog = screen.getByRole('alertdialog');
  view.rerender(viewOf({ shareToken: 'b'.repeat(43) }));
  expect(screen.getByRole('alertdialog')).toBe(dialog);
  expect(rotateShareToken).toHaveBeenCalledOnce();
  await act(async () => confirmRotation());
  view.rerender(viewOf({ shareToken: 'c'.repeat(43) }));
  expect(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(screen.getByRole('button', { name: 'Copiar link' }).disabled).toBe(true);

  await act(async () => {
    if (outcome === 'failure') secondWrite.resolve({ ok: false, status: 503, detail, errors: {} });
    else secondWrite.reject(new Error('second rotation disconnected'));
  });
  expect.soft(linkField().value).toBe(window.location.origin + '/l/' + 'c'.repeat(43));
  await act(async () => copy());
  expect.soft(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(window.location.origin + '/l/' + 'c'.repeat(43));
  expect(screen.getByRole('status').textContent).toContain(detail);
  expect(screen.getAllByText('Novo link gerado. O link anterior deixou de funcionar.')).toHaveLength(1);
  expect(rotateShareToken.mock.calls).toEqual([[LIST.id], [LIST.id]]);
  expect(refresh).toHaveBeenCalledOnce();
});

test('pending refreshed props cannot announce rotation early or overwrite its eventual returned token', async () => {
  const write = deferred();
  rotateShareToken.mockReturnValue(write.promise);
  const view = render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  view.rerender(viewOf({ shareToken: 'b'.repeat(43) }));
  expect(linkField().value).toContain(LIST.shareToken);
  expect(screen.getByRole('status').textContent).toBe('');
  await act(async () => write.resolve({ ok: true, data: { shareToken: 'c'.repeat(43) } }));
  view.rerender(viewOf({ shareToken: 'b'.repeat(43) }));
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + 'c'.repeat(43));
});

test('a failed rotation keeps the old selectable link and reports only failure', async () => {
  rotateShareToken.mockResolvedValue({ ok: false, status: 503, detail: 'Não foi possível alterar o link.', errors: {} });
  render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  expect(linkField().value).toContain(LIST.shareToken);
  expect(linkField().readOnly).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('Não foi possível alterar o link.');
  expect(screen.getByRole('status').textContent).not.toContain('Novo link gerado.');
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + LIST.shareToken);
});

test.each(['failure', 'rejection'])('a %s releases its pending snapshot so authoritative refreshed props can own the link', async (outcome) => {
  const write = deferred();
  rotateShareToken.mockReturnValue(write.promise);
  const view = render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  view.rerender(viewOf({ shareToken: 'b'.repeat(43) }));
  expect(linkField().value).toContain(LIST.shareToken);
  await act(async () => {
    if (outcome === 'failure') write.resolve({ ok: false, status: 503, detail: 'Tente novamente.', errors: {} });
    else write.reject(new Error('action disconnected'));
  });
  expect(linkField().value).toBe(window.location.origin + '/l/' + 'b'.repeat(43));
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + 'b'.repeat(43));
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).not.toContain('Novo link gerado.');
});

test('an unexpected rotation rejection keeps the link and releases controls without false success', async () => {
  rotateShareToken.mockRejectedValue(new Error('server action disconnected'));
  render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  expect(linkField().value).toContain(LIST.shareToken);
  expect(screen.getByRole('status').textContent).toContain('Não conseguimos gerar um novo link');
  expect(screen.getByRole('button', { name: 'Copiar link' }).disabled).toBe(false);
  expect(refresh).not.toHaveBeenCalled();
});

test.each(['denied', 'unavailable', 'insecure'])('clipboard %s leaves a selectable full link and useful failure feedback', async (failure) => {
  if (failure === 'denied') clipboard.writeText.mockRejectedValue(new Error('NotAllowedError'));
  if (failure === 'unavailable') vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: undefined } }));
  if (failure === 'insecure') Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
  try {
    render(viewOf());
    await act(async () => copy());
    const field = linkField();
    expect(field.value).toBe(window.location.origin + '/l/' + LIST.shareToken);
    expect(field.readOnly).toBe(true);
    fireEvent.focus(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(screen.getByRole('status').textContent).toContain('Selecione o link e copie manualmente.');
    expect(screen.getByRole('status').textContent).not.toContain('Link copiado.');
    expect(rotateShareToken).not.toHaveBeenCalled();
    if (failure !== 'denied') expect(clipboard.writeText).not.toHaveBeenCalled();
  } finally {
    if (failure === 'insecure') delete window.isSecureContext;
  }
});

test('duplicate copies and rotation cannot overlap a pending clipboard write', async () => {
  const write = deferred();
  clipboard.writeText.mockReturnValue(write.promise);
  render(viewOf());
  await act(async () => copy());
  copy();
  requestRotation();
  expect(clipboard.writeText).toHaveBeenCalledOnce();
  expect(rotateShareToken).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('');
  await act(async () => write.resolve());
  expect(screen.getByRole('status').textContent).toContain('Link copiado.');
});

test.each([
  ['rotation', 'success'], ['rotation', 'failure'], ['rotation', 'rejection'],
  ['copy', 'success'], ['copy', 'rejection'],
])('leaving during pending %s %s suppresses late feedback and refresh', async (operation, outcome) => {
  const write = deferred();
  rotateShareToken.mockReturnValue(write.promise);
  clipboard.writeText.mockReturnValue(write.promise);
  const view = render(viewOf());
  if (operation === 'rotation') {
    requestRotation();
    await act(async () => confirmRotation());
  } else await act(async () => copy());
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  await act(async () => {
    if (outcome === 'rejection') write.reject(new Error('connection ended'));
    else write.resolve(outcome === 'success'
      ? { ok: true, data: { shareToken: 'b'.repeat(43) } }
      : { ok: false, status: 503, detail: 'Tente novamente.', errors: {} });
  });
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
});

test('a confirmation is discarded when its list owner leaves', () => {
  const view = render(viewOf());
  requestRotation();
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(rotateShareToken).not.toHaveBeenCalled();
});

test('a new UUID owner cancels the old confirmation and uses its own token', async () => {
  const view = render(viewOf());
  requestRotation();
  view.rerender(viewOf({ listId: '22222222-2222-4222-8222-222222225555', shareToken: 'd'.repeat(43) }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + 'd'.repeat(43));
  expect(rotateShareToken).not.toHaveBeenCalled();
});

test('a new UUID owner ignores the previous list rotation completion', async () => {
  const write = deferred();
  rotateShareToken.mockReturnValue(write.promise);
  const view = render(viewOf());
  requestRotation();
  await act(async () => confirmRotation());
  view.rerender(viewOf({ listId: '22222222-2222-4222-8222-222222225555', shareToken: 'd'.repeat(43) }));
  await act(async () => write.resolve({ ok: true, data: { shareToken: 'b'.repeat(43) } }));
  expect(screen.getByRole('status').textContent).toBe('');
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => copy());
  expect(clipboard.writeText).toHaveBeenCalledWith(window.location.origin + '/l/' + 'd'.repeat(43));
});
