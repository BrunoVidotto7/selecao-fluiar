'use client';
import Button from '../ui/Button';
import { PasswordInput, TextInput } from '../ui/Fields';
import useDemoForm from '../forms/useDemoForm';

export default function SettingsForm({ user }) {
  const f = useDemoForm({
    initial: { nome: user.name, email: user.email, atual: '', nova: '', nova2: '' },
    rules: { nome: { required: true }, email: { required: true, email: true }, atual: { requiredIf: 'nova' }, nova: { minLength: 8 }, nova2: { match: 'nova' } },
    onSuccess: (v, { toast }) => toast('Alterações salvas.'),
  });
  return (
    <form className="settings" onSubmit={f.submit} noValidate>
      <section className="card setsec">
        <div className="about"><h2 className="sec">Perfil</h2><p>Seu nome aparece na assinatura das listas enviadas aos clientes.</p></div>
        <div className="form">
          <TextInput label="Nome completo" autoComplete="name" {...f.field('nome')} />
          <TextInput label="E-mail" type="email" autoComplete="email" hint="Se mudar o e-mail, enviaremos um link de confirmação para o endereço novo." {...f.field('email')} />
        </div>
      </section>
      <section className="card setsec">
        <div className="about"><h2 className="sec">Senha</h2><p>Deixe em branco para manter a senha atual.</p></div>
        <div className="form">
          <PasswordInput label="Senha atual" autoComplete="current-password" {...f.field('atual')} />
          <div className="row2">
            <PasswordInput label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" showStrength {...f.field('nova')} />
            <PasswordInput label="Confirme a nova senha" autoComplete="new-password" {...f.field('nova2')} />
          </div>
        </div>
      </section>
      <div className="savebar">
        <Button variant="ghost" href="/dashboard">Cancelar</Button>
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar alterações'}</Button>
      </div>
    </form>
  );
}
