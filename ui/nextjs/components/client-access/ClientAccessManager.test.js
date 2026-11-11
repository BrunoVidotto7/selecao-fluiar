import { beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ClientAccessManager from './ClientAccessManager';
import { inviteClient, revokeClientInvitation } from './actions';
import { FeedbackProvider } from '../feedback/Feedback';
import { CLIENT, CLIENT_ACCESS, INVITATION } from '@/test-support/fixtures';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', async (original) => ({ ...(await original()), useRouter: () => ({ refresh }) }));
vi.mock('./actions', () => ({ inviteClient: vi.fn(), revokeClientInvitation: vi.fn() }));
const show = (access = CLIENT_ACCESS) => render(<FeedbackProvider><ClientAccessManager clientId={CLIENT.id} access={access} /></FeedbackProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  inviteClient.mockResolvedValue({ ok: true, data: INVITATION });
  revokeClientInvitation.mockResolvedValue({ ok: true, data: undefined });
});

test('admin invites the stored client without entering an arbitrary email', async () => {
  show();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText(CLIENT.email)).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Convidar perfil' })));
  expect(inviteClient).toHaveBeenCalledExactlyOnceWith(CLIENT.id);
  expect(refresh).toHaveBeenCalledOnce();
});

test.each(['PENDING', 'EXPIRED'])('an existing %s invitation can be resent', (status) => {
  show({ ...CLIENT_ACCESS, status, invitationId: INVITATION.id, expiresAt: INVITATION.expiresAt });
  expect(screen.getByRole('button', { name: 'Reenviar convite' })).toBeTruthy();
});

test('active access displays login email separately and offers no invitation', () => {
  show({ ...CLIENT_ACCESS, status: 'ACTIVE', email: 'login@example.com' });
  expect(screen.getByText('login@example.com')).toBeTruthy();
  expect(screen.getByText('Acesso ativo')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('a failed email send does not claim success or refresh', async () => {
  inviteClient.mockResolvedValue({ ok: false, status: 500, detail: 'Não conseguimos enviar o e-mail agora.', errors: {} });
  show();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Convidar perfil' })));
  expect(screen.getByRole('status').textContent).toContain('Não conseguimos enviar');
  expect(refresh).not.toHaveBeenCalled();
});
