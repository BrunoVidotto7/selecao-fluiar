'use client';
// Administrative list with a read-only client preview.
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '../ui/Button';
import { Crumbs, EmptyState } from '../ui/Display';
import { Segmented } from '../ui/Fields';
import { useToast } from '../feedback/Feedback';
import { brl, splitTitle } from '@/lib/format';
import RoomTable from './RoomTable';
import ClientView from './ClientView';
import ShareControls from './ShareControls';
import { ListNote, ListSignature } from './ListFooter';
import { patchProduct, deleteProduct, saveProductClientNotes } from '../produtos/actions';

import { useClientChangeVisit } from '../client-changes/useClientChangeVisit';

const WRITE_FAILED_DETAIL = 'Não conseguimos salvar agora. Tente novamente.';

/** @param {{ list: import('../listas/queries.server').ListDetailResponse, signature: { officeName: string, architectNames: string[] } }} props */
export default function ShoppingList({ list, signature }) {
  return <ShoppingListContent key={list.id} list={list} signature={signature} />;
}

function ShoppingListContent({ list, signature }) {
  const { rooms, stats } = list;
  const visit = useClientChangeVisit(list.id, list.clientChanges);
  const [mode, setMode] = useState('edit'); // 'edit' | 'view'
  const [filter, setFilter] = useState('all'); // 'all' | 'pend' | 'done'
  const toast = useToast();
  const router = useRouter();
  const mounted = useRef(true);
  const pending = useRef(new Map());
  const [pendingIds, setPendingIds] = useState(new Set());
  const [t1, t2] = splitTitle(list.name);
  const base = `/listas/${list.id}`;
  const productHref = rooms.length ? `${base}/produtos/novo` : `${base}/ambientes`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const mutateProduct = (id, write, message) => {
    if (pending.current.has(id)) return pending.current.get(id);

    const operation = (async () => {
      try {
        const result = await Promise.resolve().then(write);
        if (!mounted.current) return result;
        if (result.ok) {
          toast(message);
          router.refresh();
        } else {
          toast(result.detail, 'err');
        }
        return result;
      } catch (error) {
        if (mounted.current) {
          unstable_rethrow(error);
          toast(WRITE_FAILED_DETAIL, 'err');
        }
        throw error;
      } finally {
        pending.current.delete(id);
        if (mounted.current) setPendingIds(new Set(pending.current.keys()));
      }
    })();
    pending.current.set(id, operation);
    setPendingIds(new Set(pending.current.keys()));
    return operation;
  };

  const visibleRooms = rooms.map((r) => ({ ...r, shown: r.products.filter((it) => filter === 'all' || (filter === 'done') === it.bought) }))
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

      {visit.changesByProduct.size > 0 && <div className="client-change-visit" role="status">
        {visit.readStatus === 'pending' ? 'Marcando alterações como vistas…'
          : visit.readStatus === 'success' ? 'Alterações marcadas como vistas. Os destaques permanecem nesta visita.'
            : <>Não foi possível marcar as alterações como vistas. <button type="button" className="btn btn-sm" onClick={visit.retry}>Tentar novamente</button></>}
      </div>}

      <ShareControls listId={list.id} shareToken={list.shareToken} />

      {mode === 'edit' && (
        <div>
          <div className="listbar">
            {stats.totalProducts > 0 && <Segmented label="Mostrar itens" value={filter} onChange={setFilter}
              options={[{ value: 'all', label: 'Todos', count: stats.totalProducts }, { value: 'pend', label: 'Pendentes', count: stats.pendingProducts }, { value: 'done', label: 'Comprados', count: stats.boughtProducts }]} />}
            <div className="btns">
              <Button href={`${base}/editar`} variant="ghost" size="sm" icon="edit">Editar lista</Button>
              <Button href={`${base}/ambientes`} variant="ghost" size="sm">Gerenciar ambientes</Button>
              {stats.totalProducts > 0 && <Button href={productHref} size="sm" icon="plus">Adicionar produto</Button>}
            </div>
          </div>
          {stats.totalProducts > 0 && <div className="summary">
            <div><span className="k">Itens</span><span className="v">{stats.totalProducts}</span></div>
            <div><span className="k">Comprados</span><span className="v">{stats.boughtProducts}</span></div>
            <div><span className="k">Pendentes</span><span className="v">{stats.pendingProducts}</span></div>
            <div className="bar"><span>Estimado {brl(stats.estimatedTotal)} · faltam {brl(stats.remainingTotal)}</span><span className="progress"><i style={{ width: `${stats.totalProducts ? Math.round((100 * stats.boughtProducts) / stats.totalProducts) : 0}%` }} /></span></div>
          </div>}
        </div>
      )}

      {!stats.totalProducts ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState icon="bag" title="Esta lista ainda não tem produtos" text="Adicione os produtos por ambiente, com os links das lojas e as suas observações.">
            <Button href={productHref} icon="plus">Adicionar primeiro produto</Button>
          </EmptyState>
        </div>
      ) : mode === 'view' ? (
        <ClientView rooms={rooms} />
      ) : visibleRooms.length ? (
        visibleRooms.map((r) => (
          <RoomTable key={r.id} room={r} products={r.shown} showAdd={filter === 'all'} listBase={base}
            pendingIds={pendingIds} changesByProduct={visit.changesByProduct}
            onToggle={(id, bought) => mutateProduct(id, () => patchProduct(list.id, id, { bought }),
              bought ? 'Marcado como comprado' : 'Voltou para pendentes')}
            onNotes={async (id, value) => {
              const result = await saveProductClientNotes(list.id, id, value);
              if (mounted.current && result.ok) router.refresh();
              return result;
            }}
            onQty={(id, quantity) => mutateProduct(id, () => patchProduct(list.id, id, { quantity }), 'Salvo')}
            onRemove={(id) => mutateProduct(id, () => deleteProduct(list.id, id), 'Item removido')} />
        ))
      ) : (
        <p className="filtered-empty">{filter === 'done' ? 'Nenhum item comprado ainda.' : 'Todos os itens já foram comprados.'}</p>
      )}

      <ListNote />
      <ListSignature signature={signature} />
    </div>
  );
}
