'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { Alert } from '../ui/Display';
import { TextInput, PasswordInput } from '../ui/Fields';
import useDemoForm from '../forms/useDemoForm';

export function LoginForm({ showError = false }) {
  const [failed, setFailed] = useState(showError);
  const f = useDemoForm({
    initial: { email: 'paula.hooper@fluiar.com.br', senha: '' },
    rules: { email: { required: true, email: true }, senha: { required: true } },
    onSuccess: (v, { go }) => {
      if (v.senha === 'erro') { setFailed(true); return; } // erro simulado
      go('/dashboard', 'Bem-vinda, Paula.');
    },
  });
  return (
    <>
      <header><p className="eyebrow">Bem-vinda de volta</p><h1>Entre na <em>sua conta</em></h1><p className="meta">Acesse seus clientes e as listas de compras de cada um.</p></header>
      <form className="form" onSubmit={(e) => { setFailed(false); f.submit(e); }} noValidate>
        {failed && <Alert>E-mail ou senha incorretos. Confira os dados ou redefina sua senha.</Alert>}
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="nome@escritorio.com.br" {...f.field('email')} />
        <PasswordInput label="Senha" autoComplete="current-password" placeholder="Sua senha" labelRight={<Link href="/recuperar-senha">Esqueceu a senha?</Link>} {...f.field('senha')} />
        <label className="checkrow"><input type="checkbox" className="check" defaultChecked /> Manter conectada neste aparelho</label>
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      <p className="alt">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p>
      <p className="demo">Protótipo: qualquer e-mail e senha entram. Digite <b>erro</b> na senha para ver a mensagem de erro.</p>
    </>
  );
}

export function SignupForm() {
  const f = useDemoForm({
    rules: { nome: { required: true }, email: { required: true, email: true }, senha: { required: true, minLength: 8 }, senha2: { required: true, match: 'senha' } },
    onSuccess: (v, { go }) => go('/dashboard?estado=vazio', 'Conta criada. Cadastre seu primeiro cliente.'),
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

export function ForgotPasswordForm({ sent: initialSent = false }) {
  const [sent, setSent] = useState(initialSent);
  const f = useDemoForm({ rules: { email: { required: true, email: true } }, onSuccess: () => setSent(true) });
  if (sent) {
    return (
      <div className="sent" role="status">
        <span className="art"><Icon name="send" /></span>
        <p className="eyebrow">E-mail enviado</p>
        <h1>Confira sua <em>caixa de entrada</em></h1>
        <p>Enviamos um link para <b>{f.values.email || 'paula.hooper@fluiar.com.br'}</b>. Ele vale por 1 hora.</p>
        <p className="meta">Não chegou? Veja a pasta de spam ou envie de novo.</p>
        <div className="quick">
          <Button href="/login">Voltar para o login</Button>
          <ResendButton />
        </div>
        <p className="demo" style={{ marginTop: 8 }}>Protótipo: <Link href="/nova-senha">abrir o link do e-mail</Link> para ver a tela de nova senha.</p>
      </div>
    );
  }
  return (
    <>
      <header>
        <Link className="crumbs" href="/login"><Icon name="back" /> Voltar para o login</Link>
        <h1>Recupere <em>sua senha</em></h1>
        <p className="meta">Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.</p>
      </header>
      <form className="form" onSubmit={f.submit} noValidate>
        <TextInput label="E-mail" type="email" autoComplete="email" placeholder="nome@escritorio.com.br" {...f.field('email')} />
        <Button type="submit" block busy={f.busy}>{f.busy ? 'Enviando…' : 'Enviar link de recuperação'}</Button>
      </form>
    </>
  );
}

function ResendButton() {
  const f = useDemoForm({ onSuccess: (v, { toast }) => toast('Enviamos o link de novo.') });
  return <Button variant="ghost" onClick={f.submit} busy={f.busy}>Reenviar e-mail</Button>;
}

export function ResetPasswordForm() {
  const [done, setDone] = useState(false);
  const f = useDemoForm({ rules: { senha: { required: true, minLength: 8 }, senha2: { required: true, match: 'senha' } }, onSuccess: () => setDone(true) });
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
      <header><p className="eyebrow">Redefinir senha</p><h1>Crie uma <em>senha nova</em></h1><p className="meta">Conta: paula.hooper@fluiar.com.br</p></header>
      <form className="form" onSubmit={f.submit} noValidate>
        <PasswordInput label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('senha')} />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" placeholder="Digite a senha de novo" {...f.field('senha2')} />
        <Button type="submit" block busy={f.busy}>Salvar nova senha</Button>
      </form>
    </>
  );
}
