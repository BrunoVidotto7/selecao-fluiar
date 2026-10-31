'use client';
// Página da lista de compras — mesma estrutura e visual da página original "Seleção Fluiar",
// com os controles de integração ao sistema (filtro, resumo, editar lista, adicionar produto).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '../ui/Button';
import { Crumbs, EmptyState } from '../ui/Display';
import { Segmented } from '../ui/Fields';
import { useToast } from '../feedback/Feedback';
import { brl, splitTitle } from '@/lib/format';
import RoomTable from './RoomTable';
import ClientView from './ClientView';
import { ListNote, ListSignature } from './ListFooter';

export default function ShoppingList({ list, client, rooms: initialRooms, empty = false }) {
  const [rooms, setRooms] = useState(empty ? [] : initialRooms);
  const [mode, setMode] = useState('edit'); // 'edit' | 'view' (visão do cliente)
  const [filter, setFilter] = useState('all'); // 'all' | 'pend' | 'done'
  const toast = useToast();
  const [t1, t2] = splitTitle(list.name);
  const base = `/listas/${list.id}`;

  const stats = useMemo(() => {
    const items = rooms.flatMap((r) => r.items);
    const done = items.filter((i) => i.bought).length;
    let total = 0, rest = 0;
    items.forEach((i) => { const v = (i.price || 0) * (i.qty || 1); total += v; if (!i.bought) rest += v; });
    return { n: items.length, done, pend: items.length - done, total, rest };
  }, [rooms]);

  const updateItem = (roomIdx, id, patch) => setRooms((rs) => rs.map((r, i) => (i !== roomIdx ? r : { ...r, items: r.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })));
  const removeItem = (roomIdx, id) => { setRooms((rs) => rs.map((r, i) => (i !== roomIdx ? r : { ...r, items: r.items.filter((it) => it.id !== id) }))); toast('Item removido'); };

  const visibleRooms = rooms.map((r, idx) => ({ ...r, idx, shown: r.items.filter((it) => filter === 'all' || (filter === 'done') === it.bought) }))
    .filter((r) => filter === 'all' || r.shown.length);

  return (
    <div className="listdoc">
      <Crumbs items={[{ href: '/clientes', label: 'Clientes' }, { href: `/clientes/${client.id}`, label: client.name }, { label: list.name }]} />
      <header style={{ paddingTop: 18 }}>
        <h1>{t1}{t2 && <> <em>{t2}</em></>}</h1>
        <p className="client">Cliente · <Link href={`/clientes/${client.id}`}><b>{client.name}</b></Link></p>
        <div className="meta">Separamos opções para cada item da sua casa. Clique para abrir a loja e veja nossas observações ao lado.</div>
        <div className="modebar">
          <span><b>{mode === 'edit' ? 'Modo edição' : 'Visão do cliente'}</b> · {mode === 'edit' ? 'só quem tem permissão de editar vê esta tela' : 'é assim que seu cliente vê a lista'}</span>
          <button type="button" className="btn btn-sm" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>{mode === 'edit' ? 'Ver como cliente' : 'Voltar a editar'}</button>
        </div>
      </header>

      {mode === 'edit' && stats.n > 0 && (
        <div>
          <div className="listbar">
            <Segmented label="Mostrar itens" value={filter} onChange={setFilter}
              options={[{ value: 'all', label: 'Todos', count: stats.n }, { value: 'pend', label: 'Pendentes', count: stats.pend }, { value: 'done', label: 'Comprados', count: stats.done }]} />
            <div className="btns">
              <Button href={`${base}/editar`} variant="ghost" size="sm" icon="edit">Editar lista</Button>
              <Button href={`${base}/produtos/novo`} size="sm" icon="plus">Adicionar produto</Button>
            </div>
          </div>
          <div className="summary">
            <div><span className="k">Itens</span><span className="v">{stats.n}</span></div>
            <div><span className="k">Comprados</span><span className="v">{stats.done}</span></div>
            <div><span className="k">Pendentes</span><span className="v">{stats.pend}</span></div>
            <div className="bar"><span>Estimado {brl(stats.total)} · faltam {brl(stats.rest)}</span><span className="progress"><i style={{ width: `${stats.n ? Math.round((100 * stats.done) / stats.n) : 0}%` }} /></span></div>
          </div>
        </div>
      )}

      {!stats.n ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState icon="bag" title="Esta lista ainda não tem produtos" text="Adicione os produtos por ambiente, com os links das lojas e as suas observações.">
            <Button href={`${base}/produtos/novo`} icon="plus">Adicionar primeiro produto</Button>
          </EmptyState>
        </div>
      ) : mode === 'view' ? (
        <ClientView rooms={rooms} />
      ) : visibleRooms.length ? (
        visibleRooms.map((r) => (
          <RoomTable key={r.name} room={r} items={r.shown} showAdd={filter === 'all'} listBase={base}
            onToggle={(id, v) => { updateItem(r.idx, id, { bought: v }); toast(v ? 'Marcado como comprado' : 'Voltou para pendentes'); }}
            onQty={(id, q) => { updateItem(r.idx, id, { qty: q }); toast('Salvo'); }}
            onRemove={(id) => removeItem(r.idx, id)} />
        ))
      ) : (
        <p className="filtered-empty">{filter === 'done' ? 'Nenhum item comprado ainda.' : 'Todos os itens já foram comprados.'}</p>
      )}

      <ListNote />
      <ListSignature />
    </div>
  );
}
