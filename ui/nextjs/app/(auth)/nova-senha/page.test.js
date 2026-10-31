import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Page from './page';
import ForgotPasswordPage from '../recuperar-senha/page';
import { FeedbackProvider } from '@/components/feedback/Feedback';

const { cookieStore, cookies, fetchMock, redirect, push, refresh } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  cookies: vi.fn(), fetchMock: vi.fn(), push: vi.fn(), refresh: vi.fn(),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', async (importOriginal) => {
  const { unstable_rethrow } = await importOriginal();
  return { redirect, useRouter: () => ({ push, refresh }), usePathname: () => '/nova-senha', unstable_rethrow };
});

const TOKEN = 'a'.repeat(43);
const INFO = { email: 'other@example.com' };
const INVALID_LINK = 'Este link expirou ou já foi usado. Peça um novo.';
const API_ORIGIN = 'http://localhost:8080';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const page = async (query) => Page({ searchParams: Promise.resolve(query) });
const submit = (name) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue(cookieStore);
  cookieStore.get.mockReturnValue({ value: 'revoked-jwt' });
  fetchMock.mockReset().mockImplementation(async () => json(INFO));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_ORIGIN);
  sessionStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); });

test.each([
  {}, { token: [] }, { token: [TOKEN] }, { token: [TOKEN, TOKEN] },
  { token: null }, { token: {} }, { token: 123 }, { token: '' },
  { token: 'a'.repeat(42) }, { token: 'a'.repeat(44) },
  { token: '/'.repeat(43) }, { token: TOKEN + '\n' },
])('missing or malformed query %j shows an actionable invalid link without fetching or displaying an account form', async (query) => {
  const { container } = render(await page(query));
  expect(container.textContent).toContain(INVALID_LINK);
  expect(screen.queryByLabelText('Nova senha')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Salvar nova senha' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Pedir novo link' }).getAttribute('href')).toBe('/recuperar-senha');
  expect(container.textContent).not.toContain('Conta:');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(cookies).not.toHaveBeenCalled();
});

test('a valid token awaits inspection and passes only the API email and URL token to the real form', async () => {
  let release;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  let settled = false;
  const result = page({ token: TOKEN, email: 'injected@example.com', officeId: 'ignored', accessToken: 'ignored' })
    .then((value) => { settled = true; return value; });
  await act(async () => {});
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + `/api/auth/password-resets/${TOKEN}`, expect.objectContaining({
    method: 'GET', cache: 'no-store', redirect: 'error',
  }));
  expect(settled).toBe(false);
  release(json({ ...INFO, accessToken: 'not-for-the-browser', officeId: 'not-for-the-form' }));
  const element = await result;
  expect(element.props).toEqual({ token: TOKEN, email: INFO.email });
  const { container } = render(<FeedbackProvider>{element}</FeedbackProvider>);
  expect(screen.queryByText('Conta: other@example.com')).not.toBeNull();
  expect(container.textContent).not.toContain('injected@example.com');
  expect(container.textContent).not.toContain('not-for-the-browser');
  expect(screen.queryByLabelText('Nova senha')).not.toBeNull();
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBeNull();
  expect(fetchMock.mock.calls[0][1].headers.get('Cookie')).toBeNull();
  expect(cookies).not.toHaveBeenCalled();
  expect(cookieStore.set).not.toHaveBeenCalled();
  expect(cookieStore.delete).not.toHaveBeenCalled();
});

test('one exact URL-safe token is inspected and confirmed by the concrete reset route without auto-authentication', async () => {
  const token = '-_Ab'.repeat(10) + 'XYZ';
  render(<FeedbackProvider>{await page({ token })}</FeedbackProvider>);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toBe(API_ORIGIN + `/api/auth/password-resets/${token}`);
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  type('Nova senha', '  Sênha1234 🔑  ');
  type('Confirme a nova senha', '  Sênha1234 🔑  ');
  await submit('Salvar nova senha');
  expect(fetchMock).toHaveBeenNthCalledWith(2, API_ORIGIN + '/api/auth/password-resets', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ token, newPassword: '  Sênha1234 🔑  ' }), cache: 'no-store',
  }));
  expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBeNull();
  expect(fetchMock.mock.calls[1][1].headers.get('Cookie')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Senha redefinida' })).not.toBeNull();
  expect(screen.getByRole('link', { name: 'Entrar na minha conta' }).getAttribute('href')).toBe('/login');
  expect(cookies).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test('the recovery route ignores demo state and really requests and resends using empty 202 responses', async () => {
  render(<FeedbackProvider>{await ForgotPasswordPage({ searchParams: Promise.resolve({ estado: 'enviado' }) })}</FeedbackProvider>);
  expect(screen.queryByLabelText('E-mail')).not.toBeNull();
  fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
  type('E-mail', 'other@example.com');
  await submit('Enviar link de recuperação');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(API_ORIGIN + '/api/auth/password-reset-requests', expect.objectContaining({
    method: 'POST', body: '{"email":"other@example.com"}',
  }));
  expect(screen.queryByText('Se houver uma conta com este e-mail, enviaremos um link. Ele vale por 1 hora.')).not.toBeNull();
  await submit('Reenviar e-mail');
  expect(fetchMock).toHaveBeenNthCalledWith(2, API_ORIGIN + '/api/auth/password-reset-requests', expect.objectContaining({
    method: 'POST', body: '{"email":"other@example.com"}',
  }));
  for (const [, options] of fetchMock.mock.calls) {
    expect(options.headers.get('Authorization')).toBeNull();
    expect(options.headers.get('Cookie')).toBeNull();
  }
  expect(cookies).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test('an expired or used link GET 400 renders recovery rather than invented email or password inputs', async () => {
  fetchMock.mockResolvedValue(json({ status: 400, detail: INVALID_LINK, errors: {} }, 400));
  const { container } = render(await page({ token: TOKEN }));
  expect(container.textContent).toContain(INVALID_LINK);
  expect(screen.queryByLabelText('Nova senha')).toBeNull();
  expect(screen.getByRole('link', { name: 'Pedir novo link' }).getAttribute('href')).toBe('/recuperar-senha');
  expect(container.textContent).not.toContain('Conta:');
  expect(cookies).not.toHaveBeenCalled();
});

test.each([
  [400, 'Revise os dados enviados.'],
  [429, 'Muitas tentativas. Tente novamente em alguns minutos.'],
  [503, 'Não conseguimos conectar à API. Tente novamente.'],
])('unrelated inspection failure %s reaches the auth boundary rather than the invalid-link state', async (status, detail) => {
  fetchMock.mockResolvedValue(json({ status, detail, errors: {} }, status));
  await expect(page({ token: TOKEN })).rejects.toMatchObject({ status, detail });
  expect(cookies).not.toHaveBeenCalled();
});

test.each(['network', 'proxy'])('%s inspection failure reaches the auth boundary without private details', async (kind) => {
  if (kind === 'network') fetchMock.mockRejectedValue(new TypeError('private network information'));
  else fetchMock.mockResolvedValue(new Response('<html>private proxy details</html>', { status: 502 }));
  await expect(page({ token: TOKEN })).rejects.toMatchObject({
    status: 503, detail: 'Não conseguimos conectar à API. Tente novamente.',
  });
  expect(cookies).not.toHaveBeenCalled();
});

test('an inspection 401 preserves navigation rather than displaying an expired link', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(page({ token: TOKEN })).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledExactlyOnceWith('/login');
  expect(cookies).not.toHaveBeenCalled();
});

test.each([null, {}, { email: null }, { email: [] }, { email: '' }, { email: ' ' }].map((info) => [info]))(
  'malformed reset inspection %j cannot display a fabricated account form', async (info) => {
    fetchMock.mockResolvedValue(json(info));
    await expect(page({ token: TOKEN })).rejects.toMatchObject({
      status: 502, detail: 'A API retornou uma resposta inválida.',
    });
    expect(cookies).not.toHaveBeenCalled();
  },
);

test('navigating to a new valid reset token drops the previous password draft', async () => {
  const view = render(<FeedbackProvider>{await page({ token: TOKEN })}</FeedbackProvider>);
  type('Nova senha', 'password123');
  type('Confirme a nova senha', 'password123');
  const nextToken = 'b'.repeat(43);
  fetchMock.mockResolvedValueOnce(json({ email: 'new@example.com' }));
  view.rerender(<FeedbackProvider>{await page({ token: nextToken })}</FeedbackProvider>);
  expect(screen.getByLabelText('Nova senha').value).toBe('');
  expect(screen.getByLabelText('Confirme a nova senha').value).toBe('');
  expect(screen.queryByText('Conta: new@example.com')).not.toBeNull();
});
