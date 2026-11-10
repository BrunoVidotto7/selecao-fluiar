'use client';
import { formatQuantity } from '@/lib/quantity';
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { Crumbs, EmptyState } from '../ui/Display';
import { Segmented, Select } from '../ui/Fields';
import { useToast } from '../feedback/Feedback';
import ItemLinks from '../lista/ItemLinks';
import ProductThumb from '../lista/ProductThumb';
import ProductClientNotesEditor from '../lista/ProductClientNotesEditor';
import PrintBar from '../lista/PrintBar';
import PrintSheet from '../lista/PrintSheet';
import usePrintSelection from '../lista/usePrintSelection';
import { ListNote, ListSignature } from '../lista/ListFooter';
import { splitTitle } from '@/lib/format';
import { matchesCategory, useCategoryFilter } from '@/lib/category-filter';
import { setClientPurchase, saveClientNotes } from './actions';

const SAVE_FAILED_DETAIL = 'Não conseguimos salvar agora. Tente novamente.';

export default function ClientShoppingList({ list }) {
  return <ListContent key={list.id} list={list} />;
}

function ListContent({ list }) {
  const [filter, setFilter] = useState('all');
  const [categoryId, setCategoryId, categories] = useCategoryFilter(list.rooms);
  const print = usePrintSelection(list.rooms); // Unfiltered rooms: the selection survives filters.
  const [pendingIds, setPendingIds] = useState(new Set());
  const pending = useRef(new Set());
  const mounted = useRef(true);
  const router = useRouter();
  const toast = useToast();
  const [title, emphasis] = splitTitle(list.name);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const purchase = async (productId, bought) => {
    if (pending.current.has(productId)) return;
    pending.current.add(productId);
    setPendingIds(new Set(pending.current));
    try {
      const result = await setClientPurchase(list.id, productId, bought);
      if (!mounted.current) return;
      if (result.ok) {
        toast(bought ? 'Marcado como comprado' : 'Voltou para pendentes');
        router.refresh();
      } else toast(result.detail, 'err');
    } catch (failure) {
      if (!mounted.current) return;
      unstable_rethrow(failure);
      toast(SAVE_FAILED_DETAIL, 'err');
    } finally {
      pending.current.delete(productId);
      if (mounted.current) setPendingIds(new Set(pending.current));
    }
  };
  const notes = async (productId, value) => {
    const result = await saveClientNotes(list.id, productId, value);
    if (mounted.current && result.ok) router.refresh();
    return result;
  };
  const matches = (product) => (filter === 'all' || (filter === 'done') === product.bought) && matchesCategory(product, categoryId);
  const visibleCount = list.rooms.reduce((total, room) => total + room.products.filter(matches).length, 0);
  return <div className="listdoc">
    <Crumbs items={[{ href: '/minhas-listas', label: 'Minhas listas' }, { label: list.name }]} />
    <header style={{ paddingTop: 18 }}><h1>{title}{emphasis && <> <em>{emphasis}</em></>}</h1>
      {list.description && <p className="meta">{list.description}</p>}
    </header>
    {list.stats.totalProducts > 0 ? <>
      <div className="listbar"><Segmented label="Mostrar itens" value={filter} onChange={setFilter} options={[
        { value: 'all', label: 'Todos', count: list.stats.totalProducts },
        { value: 'pending', label: 'Pendentes', count: list.stats.pendingProducts },
        { value: 'done', label: 'Comprados', count: list.stats.boughtProducts },
      ]} />
        <Select id="category-filter" label="Categoria" placeholder="Todas as categorias"
          value={categoryId} onChange={(event) => setCategoryId(event.target.value)} options={categories} /></div>
      {list.rooms.filter((room) => room.products.length).map((room) => <section key={room.id} hidden={!room.products.some(matches)}>
        <div className="roomhead"><h2>{room.name}</h2><span>{room.products.filter((product) => product.bought).length} de {room.products.length} comprados</span></div>
        <div className="tbl view"><table>
          <thead><tr><th className="pr"><input type="checkbox" className="check" checked={print.isRoomSelected({ ...room, products: room.products.filter(matches) })}
            onChange={() => print.toggleRoom({ ...room, products: room.products.filter(matches) })} aria-label={`Selecionar todos de ${room.name}`} /></th><th className="ck" aria-label="Comprado">✓</th><th className="qt">Qtd.</th><th className="it">Item</th><th>Opções e observações</th></tr></thead>
          <tbody>{room.products.map((product) => <tr key={product.id} hidden={!matches(product)} className={product.bought ? 'done' : ''}>
            <td className="pr"><input type="checkbox" className="check" checked={print.selected.has(product.id)}
              aria-label={`Imprimir: ${product.name}`} onChange={() => print.toggle(product.id)} /></td>
            <td className="ck"><input type="checkbox" className="check" checked={product.bought} disabled={pendingIds.has(product.id)}
              aria-label={`Comprado: ${product.name}`} onChange={(event) => purchase(product.id, event.target.checked)} /></td>
            <td className="qt"><span className="ro-qty">{formatQuantity(product.quantity, product.unit)}</span></td>
            <td className="it"><div className="itm">
              <ProductThumb imageUrl={product.imageUrl} />
              <div className="txt"><span className="ro-name">{product.name}</span><span className="ro-cat">{product.category.name}</span></div>
            </div></td>
            <td><ItemLinks links={product.links} empty="Opções em breve" />
              <ProductClientNotesEditor productId={product.id} productName={product.name} clientNotes={product.clientNotes}
                onSave={(value) => notes(product.id, value)} />
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>)}
      {!visibleCount && <p className="filtered-empty">{categoryId ? 'Nenhum item desta categoria com esse status.'
        : filter === 'done' ? 'Nenhum item comprado ainda.' : 'Todos os itens já foram comprados.'}</p>}
    </> : <EmptyState icon="bag" title="Esta lista ainda não tem produtos" text="O escritório está preparando sua seleção." />}
    <PrintBar count={print.selected.size} onPrint={() => window.print()} onClear={print.clear} />
    <PrintSheet title={list.name} rooms={list.rooms} selected={print.selected} />
    <ListNote /><ListSignature signature={list.signature} />
  </div>;
}
