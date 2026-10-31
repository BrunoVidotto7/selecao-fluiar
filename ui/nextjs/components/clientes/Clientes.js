'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { IconButton } from '../ui/Button';
import Button from '../ui/Button';
import { Avatar, EmptyState } from '../ui/Display';
import { SearchInput, TextInput } from '../ui/Fields';
import { useConfirm, useToast, flash } from '../feedback/Feedback';
import useApiForm from '../forms/useApiForm';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { formatShortDate, formatUpdatedAt, maskPhone, plural } from '@/lib/format';
import { EmptyLists, ListCards } from '../listas/Listas';
import { saveClient, deleteClient } from './actions';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const DELETE_FAILED_DETAIL = 'Não conseguimos excluir agora. Tente novamente.';
const DELETE_SUCCESS_DETAIL = 'Cliente excluído.';
const CLIENT_NAME_MAX_LENGTH = 120;
const CLIENT_EMAIL_MAX_LENGTH = 254;

function deleteText(name, n) {
  if (n > 1) return `As ${n} listas de compras de ${name} também serão excluídas. Essa ação não pode ser desfeita.`;
  if (n === 1) return `A lista de compras de ${name} também será excluída. Essa ação não pode ser desfeita.`;
  return 'Essa ação não pode ser desfeita.';
}

export function useDeleteClient({ destination } = {}) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return (client, listCount, onDone) => {
    if (pending.current) return;
    confirm({
      title: `Excluir ${client.name}?`,
      text: deleteText(client.name, listCount),
      confirmLabel: 'Excluir cliente',
      onConfirm: async () => {
        if (pending.current) return;
        pending.current = true;
        try {
          const result = await deleteClient(client.id);
          if (!mounted.current) return;
          if (!result.ok) {
            toast(result.detail, 'err');
            return;
          }
          await onDone?.();
          if (!mounted.current) return;
          if (destination) {
            flash(DELETE_SUCCESS_DETAIL);
            router.push(destination);
          } else {
            toast(DELETE_SUCCESS_DETAIL);
          }
          router.refresh();
        } catch (error) {
          unstable_rethrow(error);
          if (mounted.current) toast(DELETE_FAILED_DETAIL, 'err');
        } finally {
          pending.current = false;
        }
      },
    });
  };
}

/** @param {{ clients: import('./queries.server').ClientSummaryResponse[] }} props */
export function ClientsTable({ clients }) {
  const [q, setQ] = useState('');
  const del = useDeleteClient();
  const shown = useMemo(() => clients.filter((c) => norm(c.name).includes(norm(q.trim()))), [clients, q]);

  if (!clients.length) return <EmptyClients />;
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
                <td className="main"><div className="who"><Avatar name={c.name} /><div><Link href={`/clientes/${c.id}`}>{c.name}</Link><span className="sub">Cliente desde {formatShortDate(c.createdAt)}</span></div></div></td>
                <td data-label="Contato"><span>{c.email}<span className="sub">{maskPhone(c.phone)}</span></span></td>
                <td data-label="Listas" className="num">{c.listCount}</td>
                <td data-label="Atualizado">{formatUpdatedAt(c.updatedAt)}</td>
                <td className="actions-cell"><div className="actions">
                  <IconButton href={`/clientes/${c.id}`} icon="eye" label={`Ver ${c.name}`} />
                  <IconButton href={`/clientes/${c.id}/editar`} icon="edit" label={`Editar ${c.name}`} />
                  <IconButton danger icon="trash" label={`Excluir ${c.name}`} onClick={() => del(c, c.listCount)} />
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

/** @param {{ client?: import('./queries.server').ClientDetailResponse }} props */
export function ClientForm({ client }) {
  const del = useDeleteClient({ destination: '/clientes' });
  const f = useApiForm({
    initial: { nome: client?.name || '', email: client?.email || '', tel: maskPhone(client?.phone || '') },
    rules: {
      nome: { required: true, maxLength: CLIENT_NAME_MAX_LENGTH },
      email: { required: true, email: true, maxLength: CLIENT_EMAIL_MAX_LENGTH },
      tel: { phone: true },
    },
    action: (v) => saveClient(client?.id ?? null, { name: v.nome, email: v.email, phone: v.tel.replace(/\D/g, '') }),
    fieldMap: { name: 'nome', email: 'email', phone: 'tel' },
    onSuccess: (saved, values, { go }) => go(`/clientes/${saved.id}`, client ? 'Alterações salvas.' : 'Cliente cadastrado.'),
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
            onClick={() => del(client, client.lists.length)}>Excluir cliente</Button>
        )}
        <Button variant="ghost" href={client ? `/clientes/${client.id}` : '/clientes'}>Cancelar</Button>
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar cliente'}</Button>
      </div>
    </form>
  );
}

/** @param {{ client: import('./queries.server').ClientDetailResponse, children?: import('react').ReactNode }} props */
export function ClientDetail({ client, children }) {
  const lists = client.lists;
  const newHref = `/listas/nova?cliente=${client.id}`;
  return (
    <>
      <section className="card profile">
        {children}
        <div className="quick">
          <Button href={`/clientes/${client.id}/editar`} variant="ghost" icon="edit">Editar</Button>
          <DeleteClientButton client={client} listCount={lists.length} />
        </div>
      </section>
      <div className="toolbar">
        <h2 className="sec">Listas de compras {lists.length > 0 && <span className="muted">· {lists.length}</span>}</h2>
        <Button href={newHref} icon="plus">Nova lista</Button>
      </div>
      {lists.length
        ? <ListCards lists={lists} />
        : <EmptyLists clientName={client.name} newHref={newHref} />}
    </>
  );
}

export function DeleteClientButton({ client, listCount }) {
  const del = useDeleteClient({ destination: '/clientes' });
  return (
    <Button variant="text-danger" icon="trash" onClick={() => del(client, listCount)}>Excluir</Button>
  );
}
