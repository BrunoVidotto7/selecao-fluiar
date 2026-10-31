'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../ui/Button';
import { PasswordInput, TextInput } from '../ui/Fields';
import useApiForm from '../forms/useApiForm';
import { EMAIL_PASSWORD_REQUIRED } from '@/lib/validation';
import { changePassword, updateProfile } from './actions';

const PROFILE_NAME_MAX_LENGTH = 120;
const PROFILE_EMAIL_MAX_LENGTH = 254;

function ProfileForm({ user }) {
  const router = useRouter();
  const [savedEmail, setSavedEmail] = useState(user.email);
  const isNewEmail = (email) => email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();
  const f = useApiForm({
    initial: { nome: user.name, email: user.email, senhaEmail: '' },
    rules: {
      nome: { required: true, maxLength: PROFILE_NAME_MAX_LENGTH },
      email: { required: true, email: true, maxLength: PROFILE_EMAIL_MAX_LENGTH },
      senhaEmail: { required: EMAIL_PASSWORD_REQUIRED, when: (values) => isNewEmail(values.email) },
    },
    fieldMap: { name: 'nome', currentPassword: 'senhaEmail' },
    action: ({ nome, email, senhaEmail }) => updateProfile({
      name: nome, email, ...(isNewEmail(email) ? { currentPassword: senhaEmail } : {}),
    }),
    onSuccess: (data, submitted, { toast }) => {
      setSavedEmail(data.email);
      f.setValues((current) => ({
        nome: current.nome === submitted.nome ? data.name : current.nome,
        email: current.email === submitted.email ? data.email : current.email,
        senhaEmail: current.senhaEmail === submitted.senhaEmail ? '' : current.senhaEmail,
      }));
      toast('Perfil salvo.');
      router.refresh();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome completo" autoComplete="name" {...f.field('nome')} />
      <TextInput label="E-mail" type="email" autoComplete="email" hint="Para trocar o e-mail, confirme com a sua senha atual." {...f.field('email')} />
      {isNewEmail(f.values.email) && <PasswordInput label="Senha atual" autoComplete="current-password" {...f.field('senhaEmail')} />}
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar perfil'}</Button></div>
    </form>
  );
}

function PasswordForm() {
  const router = useRouter();
  const f = useApiForm({
    initial: { atual: '', nova: '', nova2: '' },
    rules: {
      atual: { requiredIf: 'nova' },
      nova: { required: true, password: true },
      nova2: { required: true, match: 'nova' },
    },
    fieldMap: { currentPassword: 'atual', newPassword: 'nova' },
    action: ({ atual, nova }) => changePassword({ currentPassword: atual, newPassword: nova }),
    onSuccess: (data, values, { toast }) => {
      f.setValues({ atual: '', nova: '', nova2: '' });
      toast('Senha alterada.');
      router.refresh();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <PasswordInput label="Senha atual" autoComplete="current-password" {...f.field('atual')} />
      <div className="row2">
        <PasswordInput label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('nova')} />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" {...f.field('nova2')} />
      </div>
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Alterando…' : 'Alterar senha'}</Button></div>
    </form>
  );
}

/** @param {{ user: import('@/lib/api.server').MeResponse }} props */
export default function SettingsForm({ user }) {
  return (
    <div className="settings">
      <section className="card setsec" aria-labelledby="perfil-title">
        <div className="about"><h2 className="sec" id="perfil-title">Perfil</h2><p>Seu nome aparece na assinatura das listas enviadas aos clientes.</p></div>
        <ProfileForm key={user.id} user={user} />
      </section>
      <section className="card setsec">
        <div className="about"><h2 className="sec">Senha</h2><p>Altere sua senha de acesso ao sistema.</p></div>
        <PasswordForm key={user.id} />
      </section>
      <div className="savebar">
        <Button variant="ghost" href="/dashboard">Cancelar</Button>
      </div>
    </div>
  );
}
