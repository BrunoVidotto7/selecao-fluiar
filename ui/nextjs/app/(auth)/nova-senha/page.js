import { ResetPasswordForm } from '@/components/auth/AuthForms';
import Button from '@/components/ui/Button';
import { ApiError, apiRequest } from '@/lib/api.server';
import { isLinkToken } from '@/lib/route-input';

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const INVALID_LINK_DETAIL = 'Este link expirou ou já foi usado. Peça um novo.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';

export const metadata = { title: 'Nova senha' };

function InvalidResetLink() {
  return (
    <div className="sent" role="status">
      <h1>Link <em>indisponível</em></h1>
      <p>{INVALID_LINK_DETAIL}</p>
      <Button href="/recuperar-senha">Pedir novo link</Button>
    </div>
  );
}

export default async function Page({ searchParams }) {
  const query = await searchParams;
  const token = query?.token;
  if (!isLinkToken(token)) return <InvalidResetLink />;

  let info;
  try {
    info = await apiRequest(`/api/auth/password-resets/${token}`, { auth: 'public' });
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_BAD_REQUEST && error.detail === INVALID_LINK_DETAIL) {
      return <InvalidResetLink />;
    }
    throw error;
  }

  if (typeof info?.email !== 'string' || !info.email.trim()) {
    throw new ApiError(HTTP_BAD_GATEWAY, INVALID_RESPONSE_DETAIL);
  }
  return <ResetPasswordForm key={token} token={token} email={info.email} />;
}
