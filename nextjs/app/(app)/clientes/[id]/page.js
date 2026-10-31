import { notFound } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { Avatar, Crumbs } from '@/components/ui/Display';
import { ClientDetail } from '@/components/clientes/Clientes';
import { CLIENTS, getClient, listsOf } from '@/lib/data';
import { splitTitle } from '@/lib/format';

export function generateStaticParams() { return CLIENTS.map((c) => ({ id: c.id })); }
export async function generateMetadata({ params }) { return { title: getClient((await params).id)?.name }; }

export default async function Page({ params, searchParams }) {
  const client = getClient((await params).id);
  if (!client) notFound();
  const empty = (await searchParams)?.estado === 'vazio';
  const lists = empty ? [] : listsOf(client.id);
  const parts = client.name.split(' ');
  return (
    <div className="wrap">
      <Crumbs items={[{ href: '/clientes', label: 'Clientes' }, { label: client.name }]} />
      <ClientDetail key={empty ? 'vazio' : 'cheio'} client={client} lists={lists}>
        <Avatar name={client.name} large />
        <div className="info">
          <p className="eyebrow">Cliente desde {client.sinceLong}</p>
          <h1 className="h1">{parts.slice(0, -1).join(' ')} <em>{parts.at(-1)}</em></h1>
          <div className="contact"><span><Icon name="mail" />{client.email}</span><span><Icon name="phone" />{client.phone}</span></div>
        </div>
      </ClientDetail>
    </div>
  );
}
