'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { TextInput, PasswordInput } from '../ui/Fields';
import useApiForm from '../forms/useApiForm';
import { confirmPasswordReset, login, requestPasswordReset, signup } from './actions';

const RESET_REQUEST_COPY = 'Se houver uma conta com este e-mail, enviaremos um link. Ele vale por 1 hora.';

export function LoginForm() {
  const f = useApiForm({
    initial: { email: '', senha: '', rememberMe: true },
    rules: { email: { required: true, email: true }, senha: { required: true } },
    fieldMap: { password: 'senha' },
    action: ({ email, senha, rememberMe }) => login({ email, password: senha, rememberMe }),
    onSuccess: (user, values, { go }) => go('/dashboard', `Bem-vinda, ${user.name}.`),
  });
  return (
    <>
      <header><p className="eyebrow">Bem-vinda de volta</p><h1>Entre na <em>sua conta</em></h1><p className="meta">Acesse seus clientes e as listas de compras de cada um.</p></header>
      <form className="form" onSubmit={f.submit} noValidate>
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="nome@escritorio.com.br" {...f.field('email')} />
        <PasswordInput label="Senha" autoComplete="current-password" placeholder="Sua senha" labelRight={<Link href="/recuperar-senha">Esqueceu a senha?</Link>} {...f.field('senha')} />
        <label className="checkrow"><input type="checkbox" className="check" checked={f.values.rememberMe} onChange={(e) => f.setValue('rememberMe', e.target.checked)} /> Manter conectada neste aparelho</label>
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      <p className="alt">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p>
    </>
  );
}

export function SignupForm() {
  const f = useApiForm({
    rules: { nome: { required: true }, email: { required: true, email: true }, senha: { required: true, password: true }, senha2: { required: true, match: 'senha' } },
    fieldMap: { name: 'nome', password: 'senha' },
    action: ({ nome, email, senha }) => signup({ name: nome, email, password: senha }),
    onSuccess: (user, values, { go }) => go('/dashboard', 'Conta criada. Cadastre seu primeiro cliente.'),
  });
  return (
    <>
      <header><p className="eyebrow">Nova conta</p><h1>Crie sua <em>conta</em></h1><p className="meta">Gratuito para começar. Leva menos de um minuto.</p></header>
      <form className="form" onSubmit={f.submit} noValidate>
        <TextInput label="Nome completo" autoComplete="name" placeholder="Como aparece nas listas para os clientes" {...f.field('nome')} />
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="nome@escritorio.com.br" {...f.field('email')} />
        <PasswordInput label="Senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('senha')} />
        <PasswordInput label="Confirme a senha" autoComplete="new-password" placeholder="Digite a senha de novo" {...f.field('senha2')} />
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Criando conta…' : 'Criar conta'}</Button>
      </form>
      <p className="alt">Já tem conta? <Link href="/login">Entrar</Link></p>
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
    rules: { senha: { required: true, password: true }, senha2: { required: true, match: 'senha' } },
    fieldMap: { newPassword: 'senha' },
    action: ({ senha }) => confirmPasswordReset({ token, newPassword: senha }),
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
        <PasswordInput label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('senha')} />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" placeholder="Digite a senha de novo" {...f.field('senha2')} />
        <Button type="submit" block busy={f.busy}>Salvar nova senha</Button>
      </form>
      <p className="alt"><Link href="/recuperar-senha">Pedir novo link</Link></p>
    </>
  );
}
