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

/** @param {{ list: import('../listas/queries.server').ListDetailResponse, signature: { officeName: string, architectNames: string[] } }} props */
export default function ShoppingList({ list, signature }) {
  // Local product edits remain temporary until inline persistence is connected.
  const [localRooms, setLocalRooms] = useState(null);
  const rooms = localRooms ?? list.rooms;
  const [mode, setMode] = useState('edit'); // 'edit' | 'view' (visão do cliente)
  const [filter, setFilter] = useState('all'); // 'all' | 'pend' | 'done'
  const toast = useToast();
  const [t1, t2] = splitTitle(list.name);
  const base = `/listas/${list.id}`;

  const stats = useMemo(() => {
    if (!localRooms) return list.stats;
    const products = localRooms.flatMap((r) => r.products);
    const done = products.filter((i) => i.bought).length;
    let total = 0, rest = 0;
    products.forEach((i) => { const v = (i.unitPrice ?? 0) * i.quantity; total += v; if (!i.bought) rest += v; });
    return { totalProducts: products.length, boughtProducts: done, pendingProducts: products.length - done, estimatedTotal: total, remainingTotal: rest };
  }, [localRooms, list.stats]);

  const updateItem = (roomIdx, id, patch) => setLocalRooms((rs) => (rs ?? list.rooms).map((r, i) => (i !== roomIdx ? r : { ...r, products: r.products.map((it) => (it.id === id ? { ...it, ...patch } : it)) })));
  const removeItem = (roomIdx, id) => { setLocalRooms((rs) => (rs ?? list.rooms).map((r, i) => (i !== roomIdx ? r : { ...r, products: r.products.filter((it) => it.id !== id) }))); toast('Item removido'); };

  const visibleRooms = rooms.map((r, idx) => ({ ...r, idx, shown: r.products.filter((it) => filter === 'all' || (filter === 'done') === it.bought) }))
    .filter((r) => filter === 'all' || r.shown.length);

  return (
    <div className="listdoc">
      <Crumbs items={[{ href: '/clientes', label: 'Clientes' }, { href: `/clientes/${list.clientId}`, label: list.clientName }, { label: list.name }]} />
      <header style={{ paddingTop: 18 }}>
        <h1>{t1}{t2 && <> <em>{t2}</em></>}</h1>
        <p className="client">Cliente · <Link href={`/clientes/${list.clientId}`}><b>{list.clientName}</b></Link></p>
        <div className="meta">Separamos opções para cada item da sua casa. Clique para abrir a loja e veja nossas observações ao lado.</div>
        <div className="modebar">
          <span><b>{mode === 'edit' ? 'Modo edição' : 'Visão do cliente'}</b> · {mode === 'edit' ? 'só quem tem permissão de editar vê esta tela' : 'é assim que seu cliente vê a lista'}</span>
          <button type="button" className="btn btn-sm" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>{mode === 'edit' ? 'Ver como cliente' : 'Voltar a editar'}</button>
        </div>
      </header>

      {mode === 'edit' && stats.totalProducts > 0 && (
        <div>
          <div className="listbar">
            <Segmented label="Mostrar itens" value={filter} onChange={setFilter}
              options={[{ value: 'all', label: 'Todos', count: stats.totalProducts }, { value: 'pend', label: 'Pendentes', count: stats.pendingProducts }, { value: 'done', label: 'Comprados', count: stats.boughtProducts }]} />
            <div className="btns">
              <Button href={`${base}/editar`} variant="ghost" size="sm" icon="edit">Editar lista</Button>
              <Button href={`${base}/produtos/novo`} size="sm" icon="plus">Adicionar produto</Button>
            </div>
          </div>
          <div className="summary">
            <div><span className="k">Itens</span><span className="v">{stats.totalProducts}</span></div>
            <div><span className="k">Comprados</span><span className="v">{stats.boughtProducts}</span></div>
            <div><span className="k">Pendentes</span><span className="v">{stats.pendingProducts}</span></div>
            <div className="bar"><span>Estimado {brl(stats.estimatedTotal)} · faltam {brl(stats.remainingTotal)}</span><span className="progress"><i style={{ width: `${stats.totalProducts ? Math.round((100 * stats.boughtProducts) / stats.totalProducts) : 0}%` }} /></span></div>
          </div>
        </div>
      )}

      {!stats.totalProducts ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState icon="bag" title="Esta lista ainda não tem produtos" text="Adicione os produtos por ambiente, com os links das lojas e as suas observações.">
            <Button href={`${base}/produtos/novo`} icon="plus">Adicionar primeiro produto</Button>
          </EmptyState>
        </div>
      ) : mode === 'view' ? (
        <ClientView rooms={rooms} />
      ) : visibleRooms.length ? (
        visibleRooms.map((r) => (
          <RoomTable key={r.id} room={r} products={r.shown} showAdd={filter === 'all'} listBase={base}
            onToggle={(id, v) => { updateItem(r.idx, id, { bought: v }); toast(v ? 'Marcado como comprado' : 'Voltou para pendentes'); }}
            onQty={(id, q) => { updateItem(r.idx, id, { quantity: q }); toast('Salvo'); }}
            onRemove={(id) => removeItem(r.idx, id)} />
        ))
      ) : (
        <p className="filtered-empty">{filter === 'done' ? 'Nenhum item comprado ainda.' : 'Todos os itens já foram comprados.'}</p>
      )}

      <ListNote />
      <ListSignature signature={signature} />
    </div>
  );
}
