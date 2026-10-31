'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { unstable_rethrow, useRouter } from 'next/navigation';
import Button, { IconButton } from '../ui/Button';
import { EmptyState, Progress, StatusBadge } from '../ui/Display';
import { SearchInput, Segmented, TextInput, Textarea, Select } from '../ui/Fields';
import { useConfirm, useToast, flash } from '../feedback/Feedback';
import useApiForm from '../forms/useApiForm';
import { brl, formatUpdatedAt, splitTitle, plural } from '@/lib/format';
import { saveList, deleteList } from './actions';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const DELETE_FAILED_DETAIL = 'Não conseguimos excluir agora. Tente novamente.';

export function useDeleteList() {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return (list, onDone) => {
    if (pending.current) return;
    confirm({
      title: `Excluir “${list.name}”?`,
      text: `Os ${list.totalProducts ?? list.stats.totalProducts} produtos desta lista também serão excluídos. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir lista',
      onConfirm: async () => {
        if (pending.current) return;
        pending.current = true;
        try {
          const result = await deleteList(list.id);
          if (!mounted.current) return;
          if (!result.ok) {
            toast(result.detail, 'err');
            return;
          }
          await onDone?.();
          if (!mounted.current) return;
          toast('Lista excluída.');
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

/** @param {{ lists: import('./queries.server').ListSummaryResponse[] }} props */
export function ListsTable({ lists }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const del = useDeleteList();
  const shown = useMemo(() => lists.filter((l) => {
    if (status === 'open' && l.completed) return false;
    if (status === 'done' && !l.completed) return false;
    return norm(`${l.name} ${l.clientName}`).includes(norm(q.trim()));
  }), [lists, q, status]);

  if (!lists.length) return <EmptyLists />;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p className="meta" style={{ margin: 0 }}>{plural(shown.length, 'lista', 'listas')}</p>
      <div className="toolbar">
        <SearchInput id="busca" label="Pesquisar listas" placeholder="Pesquisar por lista ou cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented label="Filtrar listas" value={status} onChange={setStatus}
          options={[{ value: 'all', label: 'Todas' }, { value: 'open', label: 'Em andamento' }, { value: 'done', label: 'Concluídas' }]} />
      </div>
      <div className="tbl stack">
        <table>
          <thead><tr><th>Lista</th><th>Progresso</th><th>Situação</th><th>Atualizada</th><th><span className="sr">Ações</span></th></tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td className="main"><div className="who"><div><Link href={`/listas/${l.id}`}>{l.name}</Link><span className="sub">{l.clientName}</span></div></div></td>
                <td data-label="Progresso"><div style={{ display: 'grid', gap: 5, minWidth: 120 }}><span className="num" style={{ fontSize: 13 }}>{l.boughtProducts} de {l.totalProducts} comprados</span><Progress total={l.totalProducts} done={l.boughtProducts} /></div></td>
                <td data-label="Situação"><StatusBadge total={l.totalProducts} done={l.boughtProducts} completed={l.completed} /></td>
                <td data-label="Atualizada">{formatUpdatedAt(l.updatedAt)}</td>
                <td className="actions-cell"><div className="actions">
                  <IconButton href={`/listas/${l.id}`} icon="eye" label={`Abrir ${l.name}`} />
                  <IconButton href={`/listas/${l.id}/editar`} icon="edit" label={`Editar ${l.name}`} />
                  <IconButton danger icon="trash" label={`Excluir ${l.name}`} onClick={() => del(l)} />
                </div></td>
              </tr>
            ))}
            {!shown.length && <tr className="noresults"><td colSpan={5}>Nenhuma lista encontrada{q && <> para “{q}”</>}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyLists({ clientName, newHref = '/listas/nova' }) {
  return clientName ? (
    <EmptyState icon="list" title={`${clientName.split(' ')[0]} ainda não tem listas`} text="Crie uma lista para separar os produtos que ele precisa comprar, ambiente por ambiente.">
      <Button href={newHref} icon="plus">Criar primeira lista</Button>
    </EmptyState>
  ) : (
    <EmptyState icon="list" title="Nenhuma lista criada" text="Cada lista pertence a um cliente. Crie a primeira e adicione os produtos por ambiente.">
      <Button href={newHref} icon="plus">Criar primeira lista</Button>
    </EmptyState>
  );
}

const updatedText = (u) => (/^\d/.test(u) ? `em ${u}` : u.toLowerCase());

/** @param {{ lists: import('./queries.server').ListSummaryResponse[], onDeleted?: (id: string) => void }} props */
export function ListCards({ lists, onDeleted }) {
  const del = useDeleteList();
  return (
    <div className="lists">
      {lists.map((l) => (
        <article key={l.id} className="card lcard">
          <div className="top">
            <h3><Link href={`/listas/${l.id}`}>{l.name}</Link></h3>
            <div className="actions">
              <IconButton href={`/listas/${l.id}/editar`} icon="edit" label={`Editar ${l.name}`} />
              <IconButton danger icon="trash" label={`Excluir ${l.name}`} onClick={() => del(l, () => onDeleted?.(l.id))} />
            </div>
          </div>
          <p>{l.description}</p>
          <div style={{ display: 'grid', gap: 6 }}>
            <Progress total={l.totalProducts} done={l.boughtProducts} />
            <div className="nums"><span>{l.boughtProducts} de {l.totalProducts} comprados</span><span>{brl(l.estimatedTotal)}</span></div>
          </div>
          <div className="foot">
            <span className="meta">Atualizada {updatedText(formatUpdatedAt(l.updatedAt))}</span>
            {l.completed ? <StatusBadge total={l.totalProducts} done={l.boughtProducts} completed={l.completed} /> : <Button href={`/listas/${l.id}`} variant="ghost" size="sm">Abrir lista</Button>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ListForm({ list, clients, defaultClientId = '' }) {
  const router = useRouter();
  const del = useDeleteList();
  const f = useApiForm({
    initial: { nome: list?.name || '', desc: list?.description || '', cli: list?.clientId || defaultClientId },
    rules: { nome: { required: true }, cli: { required: 'Escolha o cliente desta lista.' } },
    action: (v) => saveList(list?.id ?? null, { name: v.nome, description: v.desc.trim() || null, clientId: v.cli }),
    fieldMap: { name: 'nome', description: 'desc', clientId: 'cli' },
    onSuccess: (saved, values, { go }) => go(`/listas/${saved.id}`, 'Lista salva.'),
  });
  const [a, b] = splitTitle(f.values.nome.trim() || 'Lista de compras da casa');
  return (
    <form className="card card-pad form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome da lista" placeholder="Ex.: Lista de compras da casa" {...f.field('nome')} />
      <div className="disc" aria-live="polite">
        <b>Como o cliente vê o título</b>
        <p className="h1" style={{ fontSize: 26 }}>{a}{b && <> <em>{b}</em></>}</p>
      </div>
      <Textarea label="Descrição" optional placeholder="Ex.: Itens para a casa nova, separados por ambiente." {...f.field('desc')} />
      <Select label="Cliente" placeholder="Selecione um cliente" options={clients.map((c) => ({ value: c.id, label: c.name }))}
        hint={clients.length ? <>Cliente novo? <Link href="/clientes/novo">Cadastre aqui</Link>.</> : <Link href="/clientes/novo">Cadastre um cliente</Link>} {...f.field('cli')} />
      <div className="formfoot">
        {list && <Button variant="text-danger" icon="trash" className="left" onClick={() => del(list, () => { flash('Lista excluída.'); router.push(`/clientes/${list.clientId}`); })}>Excluir lista</Button>}
        <Button variant="ghost" href={list ? `/listas/${list.id}` : '/listas'}>Cancelar</Button>
        <Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar lista'}</Button>
      </div>
    </form>
  );
}
