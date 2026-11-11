import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';
import { CLIENT, CLIENT_ACCESS } from '@/test-support/fixtures';

const { cookies, fetchMock } = vi.hoisted(() => ({ cookies: vi.fn(), fetchMock: vi.fn() }));
vi.mock('next/headers', () => ({ cookies }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(), notFound: vi.fn(), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock('@/components/client-access/actions', () => ({ inviteClient: vi.fn(), revokeClientInvitation: vi.fn() }));
vi.mock('@/components/clientes/actions', () => ({ saveClient: vi.fn(), deleteClient: vi.fn() }));
vi.mock('@/components/listas/actions', () => ({ deleteList: vi.fn(), saveList: vi.fn() }));
vi.mock('@/components/feedback/Feedback', async (original) => ({ ...(await original()), useConfirm: () => vi.fn(), useToast: () => vi.fn() }));

const json = (body) => new Response(JSON.stringify(body), { status: 200 });
const show = async (profile) => {
  fetchMock.mockImplementation(async (url) => {
    if (url === `http://localhost:8080/api/clients/${CLIENT.id}`) return json(profile);
    if (url === `http://localhost:8080/api/clients/${CLIENT.id}/access`) return json(CLIENT_ACCESS);
    throw new Error('Unexpected request: ' + url);
  });
  render(await Page({ params: Promise.resolve({ id: CLIENT.id }) }));
};

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ get: () => ({ value: 'jwt' }) });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('profile page shows the birth date and CPF when filled', async () => {
  await show({ ...CLIENT, birthDate: '1985-03-25', cpf: '52998224725' });
  expect(screen.getByText('Nascimento: 25/03/1985')).toBeTruthy();
  expect(screen.getByText('CPF: 529.982.247-25')).toBeTruthy();
});

test('profile page hides the birth date and CPF when empty', async () => {
  await show(CLIENT);
  expect(screen.queryByText(/Nascimento:/)).toBeNull();
  expect(screen.queryByText(/CPF:/)).toBeNull();
});
