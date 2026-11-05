import ClientChangesPanel from '@/components/client-changes/ClientChangesPanel';
import { getClientChangePage } from '@/components/client-changes/queries.server';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Avatar, EmptyState, PageHeader, Progress, StatCard } from '@/components/ui/Display';
import { actionResult, getCurrentUser, readApi } from '@/lib/api.server';
import { formatUpdatedAt, plural } from '@/lib/format';

export const metadata = { title: 'Dashboard' };
const DASHBOARD_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long',
});

const MAX_CHANGES_PAGE = 2147483647;

export default async function Page({ searchParams } = {}) {
  const input = (await searchParams)?.changesPage;
  const changesPage = typeof input === 'string' && /^\d+$/.test(input) && Number(input) <= MAX_CHANGES_PAGE ? Number(input) : 0;
  const [user, dashboard, changes] = await Promise.all([
    getCurrentUser(), readApi('/api/dashboard'), actionResult(() => getClientChangePage(changesPage)),
  ]);
  const firstName = user.name.split(' ')[0];
  const actions = <><Button href="/clientes/novo" variant="ghost" icon="plus">Cadastrar cliente</Button><Button href="/listas/nova" icon="plus">Criar lista</Button></>;

  if (dashboard.clientCount === 0 && dashboard.listCount === 0) {
    return (
      <div className="wrap">
        <PageHeader eyebrow="Primeiros passos" title={<>Olá, <em>{firstName}</em></>} meta="Sua conta está pronta. Vamos montar a primeira lista." />
        <section className="stats" aria-label="Resumo">
          <StatCard label="Clientes" value={dashboard.clientCount} /><StatCard label="Listas de compras" value={dashboard.listCount} /><StatCard label="Itens pendentes" value={dashboard.pendingProductCount} />
        </section>
        <ClientChangesPanel result={changes} />
        <EmptyState icon="users" title="Cadastre seu primeiro cliente" text="Depois crie a lista de compras dele, adicione os produtos por ambiente e envie o link.">
          <Button href="/clientes/novo" icon="plus">Cadastrar cliente</Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wrap">
      <PageHeader eyebrow={DASHBOARD_DATE.format(new Date())} title={<>Olá, <em>{firstName}</em></>} meta={`Há ${dashboard.pendingProductCount} itens esperando compra em ${dashboard.listsWithPendingProductsCount} listas.`} actions={actions} />
      <section className="stats" aria-label="Resumo">
        <StatCard href="/clientes" label="Clientes" value={dashboard.clientCount} detail={`${dashboard.clientsCreatedThisMonth} novos este mês`} />
        <StatCard href="/listas" label="Listas de compras" value={dashboard.listCount} detail={plural(dashboard.completedListCount, 'concluída', 'concluídas')} />
        <StatCard href="/listas" label="Itens pendentes" value={dashboard.pendingProductCount} detail={`de ${dashboard.totalProductCount} itens nas listas`} highlight />
      </section>
      <ClientChangesPanel result={changes} />
      <div className="split">
        <section className="card">
          <div className="card-head"><h2 className="sec">Clientes recentes</h2><Link href="/clientes">Ver todos</Link></div>
          <ul className="rows">
            {dashboard.recentClients.map((c) => (
              <li key={c.id}><Link className="rowlink" href={`/clientes/${c.id}`}>
                <Avatar name={c.name} />
                <span className="grow"><span className="t">{c.name}</span><span className="s">{plural(c.listCount, 'lista', 'listas')}</span></span>
                <span className="end">{formatUpdatedAt(c.updatedAt)}</span>
              </Link></li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2 className="sec">Listas recentes</h2><Link href="/listas">Ver todas</Link></div>
          <ul className="rows">
            {dashboard.recentLists.map((l) => (
              <li key={l.id}><Link className="rowlink" href={`/listas/${l.id}`}>
                <span className="grow"><span className="t">{l.name}</span><span className="s">{l.clientName}</span></span>
                <span className="end"><span className="num">{l.boughtProducts} de {l.totalProducts} comprados</span><Progress total={l.totalProducts} done={l.boughtProducts} /></span>
              </Link></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
