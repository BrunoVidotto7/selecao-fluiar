'use client';
import { useState } from 'react';
import { getHomePath, safeReturnPath } from '@/lib/auth-routing';
import Link from 'next/link';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { TextInput, PasswordInput } from '../ui/Fields';
import useApiForm from '../forms/useApiForm';
import { confirmPasswordReset, login, requestPasswordReset } from './actions';

const RESET_REQUEST_COPY = 'Se houver uma conta com este e-mail, enviaremos um link. Ele vale por 1 hora.';

export function LoginForm({ returnTo } = {}) {
  const f = useApiForm({
    initial: { email: '', password: '', rememberMe: true },
    rules: { email: { required: true, email: true }, password: { required: true } },
    fieldMap: { password: 'password' },
    action: ({ email, password, rememberMe }) => login({ email, password, rememberMe }),
    onSuccess: (user, values, { go }) => go(safeReturnPath(returnTo) || getHomePath(user), `Bem-vinda, ${user.name}.`),
  });
  return (
    <>
      <header><p className="eyebrow">Bem-vinda de volta</p><h1>Entre na <em>sua conta</em></h1><p className="meta">Acesse suas listas de compras ou a administração do escritório.</p></header>
      <form className="form" onSubmit={f.submit} noValidate>
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="nome@escritorio.com.br" {...f.field('email')} />
        <PasswordInput label="Senha" autoComplete="current-password" placeholder="Sua senha" labelRight={<Link href="/recuperar-senha">Esqueceu a senha?</Link>} {...f.field('password')} />
        <label className="checkrow"><input type="checkbox" className="check" checked={f.values.rememberMe} onChange={(e) => f.setValue('rememberMe', e.target.checked)} /> Manter conectada neste aparelho</label>
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      <p className="alt">Seu acesso é enviado por convite do escritório.</p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState('');
  const f = useApiForm({
    rules: { email: { required: true, email: true } },
    action: ({ email }) => requestPasswordReset({ email }),
    onSuccess: (data, values) => setSentTo(values.email),
  });
  if (sentTo) {
    return (
      <div className="sent" role="status">
        <span className="art"><Icon name="send" /></span>
        <p className="eyebrow">Solicitação recebida</p>
        <h1>Confira sua <em>caixa de entrada</em></h1>
        <p>{RESET_REQUEST_COPY}</p>
        <p className="meta">E-mail informado: <b>{sentTo}</b></p>
        <p className="meta">Não chegou? Veja a pasta de spam ou envie de novo.</p>
        <div className="quick">
          <Button href="/login">Voltar para o login</Button>
          <ResendButton email={sentTo} />
        </div>
      </div>
    );
  }
  return (
    <>
      <header>
        <Link className="crumbs" href="/login"><Icon name="back" /> Voltar para o login</Link>
        <h1>Recupere <em>sua senha</em></h1>
        <p className="meta">Informe seu e-mail para pedir um link de recuperação.</p>
      </header>
      <form className="form" onSubmit={f.submit} noValidate>
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="nome@escritorio.com.br" {...f.field('email')} />
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Enviando…' : 'Enviar link de recuperação'}</Button>
      </form>
    </>
  );
}

function ResendButton({ email }) {
  const f = useApiForm({
    action: () => requestPasswordReset({ email }),
    onSuccess: (data, values, { toast }) => toast(RESET_REQUEST_COPY),
  });
  return <Button variant="ghost" onClick={f.submit} busy={f.busy}>Reenviar e-mail</Button>;
}

export function ResetPasswordForm({ token, email }) {
  const [done, setDone] = useState(false);
  const f = useApiForm({
    rules: { password: { required: true, password: true }, confirmPassword: { required: true, match: 'password' } },
    fieldMap: { newPassword: 'password' },
    action: ({ password }) => confirmPasswordReset({ token, newPassword: password }),
    onSuccess: () => setDone(true),
  });
  if (done) {
    return (
      <div className="sent" role="status">
        <span className="art"><Icon name="check" /></span>
        <p className="eyebrow">Tudo certo</p>
        <h1>Senha <em>redefinida</em></h1>
        <p>Use a senha nova da próxima vez que entrar.</p>
        <Button href="/login">Entrar na minha conta</Button>
      </div>
    );
  }
  return (
    <>
      <header><p className="eyebrow">Redefinir senha</p><h1>Crie uma <em>senha nova</em></h1><p className="meta">Conta: {email}</p></header>
      <form className="form" onSubmit={f.submit} noValidate>
        <PasswordInput label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('password')} />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" placeholder="Digite a senha de novo" {...f.field('confirmPassword')} />
        <Button type="submit" block busy={f.busy}>Salvar nova senha</Button>
      </form>
      <p className="alt"><Link href="/recuperar-senha">Pedir novo link</Link></p>
    </>
  );
}
