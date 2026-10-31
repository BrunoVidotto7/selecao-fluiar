import { notFound } from 'next/navigation';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Avatar, Crumbs } from '@/components/ui/Display';
import { DeleteClientButton } from '@/components/clientes/Clientes';
import { EmptyLists, ListCards } from '@/components/listas/Listas';
import { CLIENTS, getClient, listsOf } from '@/lib/data';
import { splitTitle } from '@/lib/format';

export function generateStaticParams() { return CLIENTS.map((c) => ({ id: c.id })); }
export async function generateMetadata({ params }) { return { title: getClient((await params).id)?.name }; }

export default async function Page({ params, searchParams }) {
  const client = getClient((await params).id);
  if (!client) notFound();
  const lists = (await searchParams)?.estado === 'vazio' ? [] : listsOf(client.id);
  const parts = client.name.split(' ');
  const newHref = `/listas/nova?cliente=${client.id}`;
  return (
    <div className="wrap">
      <Crumbs items={[{ href: '/clientes', label: 'Clientes' }, { label: client.name }]} />
      <section className="card profile">
        <Avatar name={client.name} large />
        <div className="info">
          <p className="eyebrow">Cliente desde {client.sinceLong}</p>
          <h1 className="h1">{parts.slice(0, -1).join(' ')} <em>{parts.at(-1)}</em></h1>
          <div className="contact"><span><Icon name="mail" />{client.email}</span><span><Icon name="phone" />{client.phone}</span></div>
        </div>
        <div className="quick">
          <Button href={`/clientes/${client.id}/editar`} variant="ghost" icon="edit">Editar</Button>
          <DeleteClientButton client={client} listCount={lists.length} />
        </div>
      </section>
      <div className="toolbar">
        <h2 className="sec">Listas de compras {lists.length > 0 && <span className="muted">· {lists.length}</span>}</h2>
        <Button href={newHref} icon="plus">Nova lista</Button>
      </div>
      {lists.length ? <ListCards lists={lists} /> : <EmptyLists clientName={client.name} newHref={newHref} />}
    </div>
  );
}
