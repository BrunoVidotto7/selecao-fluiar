import { notFound } from 'next/navigation';
import ClientView from '@/components/lista/ClientView';
import { ListNote, ListSignature } from '@/components/lista/ListFooter';
import { readApi } from '@/lib/api.server';
import { isLinkToken } from '@/lib/route-input';
import { splitTitle } from '@/lib/format';

export const metadata = { title: 'Lista compartilhada' };

/** @param {{ params: Promise<{ shareToken: string }> }} props */
export default async function Page({ params }) {
  const { shareToken } = await params;
  if (!isLinkToken(shareToken)) notFound();
  const list = await readApi(`/api/public/lists/${shareToken}`, { auth: 'public' });
  const [title, emphasis] = splitTitle(list.name);

  return (
    <main className="wrap doc listdoc">
      <header>
        <h1>{title}{emphasis && <> <em>{emphasis}</em></>}</h1>
        {list.description && <p className="meta">{list.description}</p>}
      </header>
      {list.rooms.some((room) => room.products.length)
        ? <ClientView rooms={list.rooms} />
        : <p className="empty">Esta lista ainda não tem produtos</p>}
      <ListNote />
      <ListSignature signature={list.signature} />
    </main>
  );
}
