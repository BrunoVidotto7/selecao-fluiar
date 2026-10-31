'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconButton } from '../ui/Button';
import Button from '../ui/Button';
import { Avatar, EmptyState } from '../ui/Display';
import { SearchInput, TextInput } from '../ui/Fields';
import { useConfirm, useToast, flash } from '../feedback/Feedback';
import useDemoForm from '../forms/useDemoForm';
import { useRouter } from 'next/navigation';
import { maskPhone, plural } from '@/lib/format';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function deleteText(name, n) {
  if (n > 1) return `As ${n} listas de compras de ${name} também serão excluídas. Essa ação não pode ser desfeita.`;
  if (n === 1) return `A lista de compras de ${name} também será excluída. Essa ação não pode ser desfeita.`;
  return 'Essa ação não pode ser desfeita.';
}

// Hook para excluir cliente com confirmação (usado na tabela, no detalhe e no formulário)
export function useDeleteClient() {
  const confirm = useConfirm();
  return (client, listCount, onDone) => confirm({
    title: `Excluir ${client.name}?`, text: deleteText(client.name, listCount), confirmLabel: 'Excluir cliente', onConfirm: onDone,
  });
}

export function ClientsTable({ clients }) {
  const [rows, setRows] = useState(clients);
  const [q, setQ] = useState('');
  const toast = useToast();
  const del = useDeleteClient();
  const shown = useMemo(() => rows.filter((c) => norm(c.name).includes(norm(q.trim()))), [rows, q]);

  if (!rows.length) return <EmptyClients />;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p className="meta" style={{ margin: 0 }}>{plural(shown.length, 'cliente', 'clientes')}{q && ` para “${q}”`}</p>
      <div className="toolbar"><SearchInput id="busca" label="Pesquisar clientes" placeholder="Pesquisar por nome" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="tbl stack">
        <table>
          <thead><tr><th>Cliente</th><th>Contato</th><th>Listas</th><th>Atualizado</th><th><span className="sr">Ações</span></th></tr></thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td className="main"><div className="who"><Avatar name={c.name} /><div><Link href={`/clientes/${c.id}`}>{c.name}</Link><span className="sub">Cliente desde {c.since}</span></div></div></td>
                <td data-label="Contato"><span>{c.email}<span className="sub">{c.phone}</span></span></td>
                <td data-label="Listas" className="num">{c.listCount}</td>
                <td data-label="Atualizado">{c.updated}</td>
                <td className="actions-cell"><div className="actions">
                  <IconButton href={`/clientes/${c.id}`} icon="eye" label={`Ver ${c.name}`} />
                  <IconButton href={`/clientes/${c.id}/editar`} icon="edit" label={`Editar ${c.name}`} />
                  <IconButton danger icon="trash" label={`Excluir ${c.name}`} onClick={() => del(c, c.listCount, () => { setRows((r) => r.filter((x) => x.id !== c.id)); toast('Cliente excluído.'); })} />
                </div></td>
              </tr>
            ))}
            {!shown.length && (
              <tr className="noresults"><td colSpan={5}>Nenhum cliente encontrado para “{q}”. Confira a grafia ou <Link href="/clientes/novo">cadastre um cliente novo</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyClients() {
  return (
    <EmptyState icon="users" title="Nenhum cliente por aqui ainda" text="Cadastre um cliente para começar a montar as listas de compras dele.">
      <Button href="/clientes/novo" icon="plus">Cadastrar primeiro cliente</Button>
    </EmptyState>
  );
}

export function ClientForm({ client, listCount = 0 }) {
  const router = useRouter();
  const del = useDeleteClient();
  const f = useDemoForm({
    initial: { nome: client?.name || '', email: client?.email || '', tel: client?.phone || '' },
    rules: { nome: { required: true }, email: { required: true, email: true }, tel: { required: true } },
    onSuccess: (v, { go }) => go(`/clientes/${client?.id || 'sergio-hooper'}`, client ? 'Alterações salvas.' : 'Cliente cadastrado.'),
  });
  const tel = f.field('tel');
  return (
    <form className="card card-pad form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome completo" autoComplete="off" placeholder="Ex.: Marina Duarte" {...f.field('nome')} />
      <div className="row2">
        <TextInput label="E-mail" type="email" placeholder="nome@email.com" hint="Usado para enviar o link da lista ao cliente." {...f.field('email')} />
        <TextInput label="Telefone" type="tel" inputMode="tel" placeholder="(31) 99999-9999" {...tel} onChange={(e) => f.setValue('tel', maskPhone(e.target.value))} />
      </div>
      <div className="formfoot">
        {client && (
          <Button variant="text-danger" icon="trash" className="left"
            onClick={() => del(client, listCount, () => { flash('Cliente excluído.'); router.push('/clientes'); })}>Excluir cliente</Button>
        )}
        <Button variant="ghost" href={client ? `/clientes/${client.id}` : '/clientes'}>Cancelar</Button>
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar cliente'}</Button>
      </div>
    </form>
  );
}

export function DeleteClientButton({ client, listCount }) {
  const router = useRouter();
  const del = useDeleteClient();
  return (
    <Button variant="text-danger" icon="trash" onClick={() => del(client, listCount, () => { flash('Cliente excluído.'); router.push('/clientes'); })}>Excluir</Button>
  );
}
