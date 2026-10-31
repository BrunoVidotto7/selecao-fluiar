import InvitationForm from '@/components/convite/InvitationForm';
import Button from '@/components/ui/Button';
import { ApiError, apiRequest } from '@/lib/api.server';
import { isLinkToken } from '@/lib/route-input';

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const INVALID_LINK_DETAIL = 'Este link expirou ou já foi usado. Peça um novo.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';
const INVITATION_FIELDS = ['email', 'officeName', 'invitedByName'];

export const metadata = { title: 'Aceitar convite — Seleção Fluiar' };

function InvalidInvitation() {
  return (
    <div className="sent" role="status">
      <h1>Convite <em>indisponível</em></h1>
      <p>{INVALID_LINK_DETAIL}</p>
      <p className="meta">Peça um novo convite ao escritório.</p>
      <Button href="/login">Voltar para o login</Button>
    </div>
  );
}

export default async function Page({ searchParams }) {
  const query = await searchParams;
  const token = query?.token;
  if (!isLinkToken(token)) return <InvalidInvitation />;

  let invitation;
  try {
    invitation = await apiRequest(`/api/auth/invitations/${token}`, { auth: 'public' });
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_BAD_REQUEST && error.detail === INVALID_LINK_DETAIL) {
      return <InvalidInvitation />;
    }
    throw error;
  }

  if (INVITATION_FIELDS.some((field) => typeof invitation?.[field] !== 'string' || !invitation[field].trim())) {
    throw new ApiError(HTTP_BAD_GATEWAY, INVALID_RESPONSE_DETAIL);
  }
  return <InvitationForm key={token} token={token} invitation={invitation} />;
}
