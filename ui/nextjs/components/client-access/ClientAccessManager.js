'use client';
import { useRouter } from 'next/navigation';
import Button from '../ui/Button';
import useApiForm from '../forms/useApiForm';
import { formatLongDate } from '@/lib/format';
import { inviteClient, revokeClientInvitation } from './actions';

const ACCESS_LABELS = { NOT_INVITED: 'Sem convite', PENDING: 'Convite pendente', EXPIRED: 'Convite expirado', ACTIVE: 'Acesso ativo' };

export default function ClientAccessManager(props) {
  return <AccessControls key={props.clientId} {...props} />;
}

function AccessControls({ clientId, access }) {
  const router = useRouter();
  const invite = useApiForm({
    action: () => inviteClient(clientId),
    onSuccess: (data, values, { toast }) => { toast('Convite enviado.'); router.refresh(); },
  });
  const revoke = useApiForm({
    action: () => revokeClientInvitation(clientId, access.invitationId),
    onSuccess: (data, values, { toast }) => { toast('Convite revogado.'); router.refresh(); },
  });
  const busy = invite.busy || revoke.busy;
  const active = access.status === 'ACTIVE';
  return (
    <section className="card card-pad" aria-label="Acesso do perfil" style={{ marginTop: 20, marginBottom: 20 }}>
      <h2 className="sec">Acesso do perfil</h2>
      <p><span className="badge">{ACCESS_LABELS[access.status]}</span></p>
      <p className="meta">{active ? 'E-mail de acesso' : 'O convite será enviado para'}: <b>{access.email}</b></p>
      {active && <p className="meta">Alterar o contato do cadastro não altera este e-mail de acesso.</p>}
      {access.expiresAt && <p className="meta">Validade: {formatLongDate(access.expiresAt)}</p>}
      {!active && <div className="quick">
        <form onSubmit={invite.submit} noValidate>
          <Button type="submit" busy={invite.busy} disabled={busy}>
            {invite.busy ? 'Enviando…' : access.status === 'NOT_INVITED' ? 'Convidar perfil' : 'Reenviar convite'}
          </Button>
        </form>
        {access.invitationId && <form onSubmit={revoke.submit} noValidate>
          <Button type="submit" variant="text-danger" busy={revoke.busy} disabled={busy}>Revogar convite</Button>
        </form>}
      </div>}
    </section>
  );
}
