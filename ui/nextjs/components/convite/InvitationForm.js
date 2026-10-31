'use client';
import Link from 'next/link';
import { TextInput, PasswordInput } from '../ui/Fields';
import Button from '../ui/Button';
import useApiForm from '../forms/useApiForm';
import { acceptInvitation } from './actions';

const INVITEE_NAME_MAX_LENGTH = 120;

/** @typedef {{ email: string, officeName: string, invitedByName: string }} InvitationInfoResponse */

/** @param {{ token: string, invitation: InvitationInfoResponse }} props */
export default function InvitationForm({ token, invitation }) {
  const f = useApiForm({
    initial: { nome: '', senha: '', senha2: '' },
    rules: {
      nome: { required: true, maxLength: INVITEE_NAME_MAX_LENGTH },
      senha: { required: true, password: true },
      senha2: { required: true, match: 'senha' },
    },
    fieldMap: { name: 'nome', password: 'senha' },
    action: ({ nome, senha }) => acceptInvitation(token, { name: nome, password: senha }),
    onSuccess: (user, values, { go }) => go('/dashboard', `Bem-vinda, ${user.name}.`),
  });
  return (
    <>
      <header>
        <p className="eyebrow">Convite para o escritório</p>
        <h1>Aceite seu <em>convite</em></h1>
        <p className="meta">Convidada por {invitation.invitedByName}.</p>
        <p className="meta">Este convite cria uma conta para {invitation.email} no escritório {invitation.officeName}. Ao aceitar, você entrará nessa conta neste navegador.</p>
      </header>
      <form className="form" onSubmit={f.submit} noValidate>
        <TextInput label="Nome completo" autoComplete="name" {...f.field('nome')} />
        <PasswordInput label="Senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('senha')} />
        <PasswordInput label="Confirme a senha" autoComplete="new-password" placeholder="Digite a senha de novo" {...f.field('senha2')} />
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Criando conta…' : 'Criar conta e aceitar convite'}</Button>
      </form>
      <p className="alt"><Link href="/login">Voltar para o login</Link></p>
    </>
  );
}
