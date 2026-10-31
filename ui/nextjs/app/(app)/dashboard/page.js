import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Avatar, EmptyState, PageHeader, Progress, StatCard } from '@/components/ui/Display';
import { CLIENTS, LISTS, USER, listsOf, getClient } from '@/lib/data';
import { plural } from '@/lib/format';

export const metadata = { title: 'Dashboard' };
const firstName = USER.name.split(' ')[0];

export default async function Page({ searchParams }) {
  const empty = (await searchParams)?.estado === 'vazio';
  const actions = <><Button href="/clientes/novo" variant="ghost" icon="plus">Cadastrar cliente</Button><Button href="/listas/nova" icon="plus">Criar lista</Button></>;

  if (empty) {
    return (
      <div className="wrap">
        <PageHeader eyebrow="Primeiros passos" title={<>Olá, <em>{firstName}</em></>} meta="Sua conta está pronta. Vamos montar a primeira lista." />
        <section className="stats" aria-label="Resumo">
          <StatCard label="Clientes" value={0} /><StatCard label="Listas de compras" value={0} /><StatCard label="Itens pendentes" value={0} />
        </section>
        <EmptyState icon="users" title="Cadastre seu primeiro cliente" text="Depois crie a lista de compras dele, adicione os produtos por ambiente e envie o link.">
          <Button href="/clientes/novo" icon="plus">Cadastrar cliente</Button>
        </EmptyState>
      </div>
    );
  }

  const total = LISTS.reduce((s, l) => s + l.total, 0);
  const done = LISTS.reduce((s, l) => s + l.bought, 0);
  const open = LISTS.filter((l) => l.bought < l.total).length;
  const finished = LISTS.length - open;

  return (
    <div className="wrap">
      <PageHeader eyebrow="Sexta-feira, 30 de outubro" title={<>Olá, <em>{firstName}</em></>} meta={`Há ${total - done} itens esperando compra em ${open} listas.`} actions={actions} />
      <section className="stats" aria-label="Resumo">
        <StatCard href="/clientes" label="Clientes" value={CLIENTS.length} detail="2 novos este mês" />
        <StatCard href="/listas" label="Listas de compras" value={LISTS.length} detail={plural(finished, 'concluída', 'concluídas')} />
        <StatCard href="/listas" label="Itens pendentes" value={total - done} detail={`de ${total} itens nas listas`} highlight />
      </section>
      <div className="split">
        <section className="card">
          <div className="card-head"><h2 className="sec">Clientes recentes</h2><Link href="/clientes">Ver todos</Link></div>
          <ul className="rows">
            {CLIENTS.slice(0, 5).map((c) => (
              <li key={c.id}><Link className="rowlink" href={`/clientes/${c.id}`}>
                <Avatar name={c.name} />
                <span className="grow"><span className="t">{c.name}</span><span className="s">{plural(listsOf(c.id).length, 'lista', 'listas')}</span></span>
                <span className="end">{c.updated}</span>
              </Link></li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2 className="sec">Listas recentes</h2><Link href="/listas">Ver todas</Link></div>
          <ul className="rows">
            {LISTS.slice(0, 5).map((l) => (
              <li key={l.id}><Link className="rowlink" href={`/listas/${l.id}`}>
                <span className="grow"><span className="t">{l.name}</span><span className="s">{getClient(l.clientId).name}</span></span>
                <span className="end"><span className="num">{l.bought} de {l.total} comprados</span><Progress total={l.total} done={l.bought} /></span>
              </Link></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
