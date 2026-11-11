import Icon from '@/components/ui/Icon';
import ClientAccessManager from '@/components/client-access/ClientAccessManager';
import { getClientAccess } from '@/components/client-access/queries.server';
import { Avatar, Crumbs } from '@/components/ui/Display';
import { ClientDetail } from '@/components/clientes/Clientes';
import { getClient } from '@/components/clientes/queries.server';
import { formatIsoDate, formatLongDate, maskCpf, maskPhone } from '@/lib/format';

export async function generateMetadata({ params }) {
  const client = await getClient((await params).id);
  return { title: client.name };
}

export default async function Page({ params }) {
  const client = await getClient((await params).id);
  const access = await getClientAccess(client.id);
  const parts = client.name.split(' ');
  return (
    <div className="wrap">
      <Crumbs items={[{ href: '/perfis', label: 'Perfis' }, { label: client.name }]} />
      <ClientDetail key={client.id} client={client}>
        <Avatar name={client.name} large />
        <div className="info">
          <p className="eyebrow">Perfil desde {formatLongDate(client.createdAt)}</p>
          <h1 className="h1">{parts.slice(0, -1).join(' ')} <em>{parts.at(-1)}</em></h1>
          <div className="contact"><span><Icon name="mail" />{client.email}</span><span><Icon name="phone" />{maskPhone(client.phone)}</span>
            {client.birthDate && <span>Nascimento: {formatIsoDate(client.birthDate)}</span>}
            {client.cpf && <span>CPF: {maskCpf(client.cpf)}</span>}
          </div>
        </div>
      </ClientDetail>
      <ClientAccessManager clientId={client.id} access={access} />
    </div>
  );
}
