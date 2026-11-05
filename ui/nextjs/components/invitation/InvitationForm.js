'use client';
import Link from 'next/link';
import { PasswordInput } from '../ui/Fields';
import Button from '../ui/Button';
import useApiForm from '../forms/useApiForm';
import { acceptInvitation } from './actions';

export default function InvitationForm({ token, invitation }) {
  const form = useApiForm({
    initial: { password: '', confirmPassword: '' },
    rules: { password: { required: true, password: true }, confirmPassword: { required: true, match: 'password' } },
    action: ({ password }) => acceptInvitation(token, { password }),
    onSuccess: (user, values, { go }) => go('/minhas-listas', `Bem-vinda, ${user.name}.`),
  });
  return <>
    <header>
      <p className="eyebrow">Convite para suas listas</p>
      <h1>Aceite seu <em>convite</em></h1>
      <p className="meta">Cliente: <b>{invitation.clientName}</b></p>
      <p className="meta">Convidada por {invitation.invitedByName}.</p>
      <p className="meta">Este convite cria uma conta para {invitation.email} no escritório {invitation.officeName}. Ao aceitar, você entrará nessa conta neste navegador.</p>
    </header>
    <form className="form" onSubmit={form.submit} noValidate>
      <PasswordInput label="Senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...form.field('password')} />
      <PasswordInput label="Confirme a senha" autoComplete="new-password" placeholder="Digite a senha de novo" {...form.field('confirmPassword')} />
      <Button type="submit" block busy={form.busy}>{form.busy ? 'Criando conta…' : 'Criar conta e aceitar convite'}</Button>
    </form>
    <p className="alt"><Link href="/login">Voltar para o login</Link></p>
  </>;
}
