'use client';
import { useState } from 'react';
import { getHomePath } from '@/lib/auth-routing';
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
    initial: { name: user.name, email: user.email, emailPassword: '' },
    rules: {
      name: { required: true, maxLength: PROFILE_NAME_MAX_LENGTH },
      email: { required: true, email: true, maxLength: PROFILE_EMAIL_MAX_LENGTH },
      emailPassword: { required: EMAIL_PASSWORD_REQUIRED, when: (values) => isNewEmail(values.email) },
    },
    fieldMap: { name: 'name', currentPassword: 'emailPassword' },
    action: ({ name, email, emailPassword }) => updateProfile({
      name, email, ...(isNewEmail(email) ? { currentPassword: emailPassword } : {}),
    }),
    onSuccess: (data, submitted, { toast }) => {
      setSavedEmail(data.email);
      f.setValues((current) => ({
        name: current.name === submitted.name ? data.name : current.name,
        email: current.email === submitted.email ? data.email : current.email,
        emailPassword: current.emailPassword === submitted.emailPassword ? '' : current.emailPassword,
      }));
      toast('Perfil salvo.');
      router.refresh();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome completo" autoComplete="name" {...f.field('name')} />
      <TextInput label="E-mail" type="email" autoComplete="email" hint="Para trocar o e-mail, confirme com a sua senha atual." {...f.field('email')} />
      {isNewEmail(f.values.email) && <PasswordInput label="Senha atual" autoComplete="current-password" {...f.field('emailPassword')} />}
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar perfil'}</Button></div>
    </form>
  );
}

function PasswordForm() {
  const router = useRouter();
  const f = useApiForm({
    initial: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
    rules: {
      currentPassword: { requiredIf: 'newPassword' },
      newPassword: { required: true, password: true },
      confirmNewPassword: { required: true, match: 'newPassword' },
    },
    fieldMap: { currentPassword: 'currentPassword', newPassword: 'newPassword' },
    action: ({ currentPassword, newPassword }) => changePassword({ currentPassword, newPassword }),
    onSuccess: (data, values, { toast }) => {
      f.setValues({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      toast('Senha alterada.');
      router.refresh();
    },
  });
  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <PasswordInput label="Senha atual" autoComplete="current-password" {...f.field('currentPassword')} />
      <div className="row2">
        <PasswordInput label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('newPassword')} />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" {...f.field('confirmNewPassword')} />
      </div>
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Alterando…' : 'Alterar senha'}</Button></div>
    </form>
  );
}

/** @param {{ user: import('@/lib/api.server').MeResponse }} props */
export default function SettingsForm({ user }) {
  return (
    <div className="settings">
      <section className="card setsec" aria-labelledby="profile-title">
        <div className="about"><h2 className="sec" id="profile-title">Perfil</h2><p>{user.role === 'ADMIN' ? 'Seu nome aparece na assinatura das listas enviadas aos perfis.' : 'Gerencie os dados da sua conta.'}</p></div>
        <ProfileForm key={user.id} user={user} />
      </section>
      <section className="card setsec">
        <div className="about"><h2 className="sec">Senha</h2><p>Altere sua senha de acesso ao sistema.</p></div>
        <PasswordForm key={user.id} />
      </section>
      <div className="savebar">
        <Button variant="ghost" href={getHomePath(user)}>Cancelar</Button>
      </div>
    </div>
  );
}
