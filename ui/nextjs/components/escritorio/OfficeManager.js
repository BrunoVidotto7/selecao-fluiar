'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../ui/Button';
import { TextInput } from '../ui/Fields';
import { useConfirm } from '../feedback/Feedback';
import useApiForm from '../forms/useApiForm';
import { formatLongDate } from '@/lib/format';
import { inviteMember, renameOffice, revokeInvitation } from './actions';

const OFFICE_NAME_MAX_LENGTH = 120;
const INVITATION_EMAIL_MAX_LENGTH = 254;

function RenameOfficeForm({ office }) {
  const router = useRouter();
  const confirmedName = useRef(office.name);
  const unacknowledgedName = useRef(null);
  const f = useApiForm({
    initial: { nomeEscritorio: office.name },
    rules: { nomeEscritorio: { required: true, maxLength: OFFICE_NAME_MAX_LENGTH } },
    fieldMap: { name: 'nomeEscritorio' },
    action: ({ nomeEscritorio }) => renameOffice({ name: nomeEscritorio }),
    onSuccess: (data, submitted, { toast }) => {
      const supersededNames = new Set(unacknowledgedName.current?.supersededNames);
      supersededNames.add(confirmedName.current);
      unacknowledgedName.current = { name: data.name, supersededNames };
      confirmedName.current = data.name;
      f.setValues((current) => current.nomeEscritorio === submitted.nomeEscritorio
        ? { ...current, nomeEscritorio: data.name }
        : current);
      toast('Escritório salvo.');
      router.refresh();
    },
  });
  const { busy, setValues } = f;
  useEffect(() => {
    if (busy) return;
    // Props de nomes já substituídos não podem desfazer o último salvamento.
    const unacknowledged = unacknowledgedName.current;
    if (unacknowledged) {
      if (office.name !== unacknowledged.name && unacknowledged.supersededNames.has(office.name)) return;
      unacknowledgedName.current = null;
    }
    const previousName = confirmedName.current;
    if (office.name === previousName) return;
    confirmedName.current = office.name;
    setValues((current) => current.nomeEscritorio === previousName
      ? { ...current, nomeEscritorio: office.name }
      : current);
  }, [busy, office.name, setValues]);

  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome do escritório" autoComplete="organization" {...f.field('nomeEscritorio')} />
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar escritório'}</Button></div>
    </form>
  );
}

function InvitationForm() {
  const router = useRouter();
  const f = useApiForm({
    initial: { emailConvite: '' },
    rules: { emailConvite: { required: true, email: true, maxLength: INVITATION_EMAIL_MAX_LENGTH } },
    fieldMap: { email: 'emailConvite' },
    action: ({ emailConvite }) => inviteMember({ email: emailConvite }),
    onSuccess: (data, values, { toast }) => {
      toast('Convite enviado.');
      router.refresh();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="E-mail do convite" type="email" autoComplete="off" {...f.field('emailConvite')} />
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Enviando…' : 'Enviar convite'}</Button></div>
    </form>
  );
}

function RevokeInvitationButton({ invitation }) {
  const router = useRouter();
  const confirm = useConfirm();
  const form = useRef(null);
  const f = useApiForm({
    action: () => revokeInvitation(invitation.id),
    onSuccess: (data, values, { toast }) => {
      toast('Convite revogado.');
      document.getElementById('emailConvite')?.focus();
      router.refresh();
    },
  });
  return (
    <form ref={form} onSubmit={f.submit} noValidate>
      <Button variant="text-danger" size="sm" busy={f.busy} aria-label={`Revogar convite para ${invitation.email}`}
        onClick={() => confirm({
          title: 'Revogar convite?',
          text: 'O link do convite deixará de funcionar. Para convidar essa pessoa depois, envie um novo convite.',
          confirmLabel: 'Revogar convite',
          onConfirm: () => form.current?.requestSubmit(),
        })}>
        {f.busy ? 'Revogando…' : 'Revogar convite'}
      </Button>
    </form>
  );
}

/**
 * @param {{ office: import('./actions').OfficeResponse,
 *   invitations: import('./actions').InvitationResponse[], now: string }} props
 */
export default function OfficeManager({ office, invitations, now }) {
  const serverInstant = Date.parse(now);
  return (
    <div className="settings">
      <section className="card setsec" aria-labelledby="escritorio-title">
        <div className="about">
          <h2 className="sec" id="escritorio-title">Dados do escritório</h2>
          <p>O nome do escritório aparece na assinatura das listas enviadas aos clientes.</p>
        </div>
        <RenameOfficeForm key={office.id} office={office} />
      </section>
      <section className="card setsec" aria-labelledby="membros-title">
        <div className="about"><h2 className="sec" id="membros-title">Membros</h2><p>Pessoas que compartilham os clientes e as listas deste escritório.</p></div>
        <ul className="rows office-rows">
          {office.members.map((member) => (
            <li key={member.id}><div className="office-person"><strong>{member.name}</strong><span className="meta">{member.email}</span></div></li>
          ))}
        </ul>
      </section>
      <section className="card setsec" aria-labelledby="convites-title">
        <div className="about">
          <h2 className="sec" id="convites-title">Convites</h2>
          <p>Convide uma pessoa para criar uma conta neste escritório. O link vale por 7 dias.</p>
        </div>
        <div className="form">
          <InvitationForm />
          {invitations.length ? (
            <ul className="rows office-rows">
              {invitations.map((invitation) => {
                const expired = Date.parse(invitation.expiresAt) <= serverInstant;
                return (
                  <li key={invitation.id}>
                    <div className="office-person">
                      <strong>{invitation.email}</strong>
                      <span className="meta">Validade: <time dateTime={invitation.expiresAt}>{formatLongDate(invitation.expiresAt)}</time></span>
                    </div>
                    <span className="badge badge-pend">{expired ? 'Expirado' : 'Pendente'}</span>
                    {!expired && <RevokeInvitationButton invitation={invitation} />}
                  </li>
                );
              })}
            </ul>
          ) : <p className="meta">Nenhum convite por aqui.</p>}
        </div>
      </section>
    </div>
  );
}
