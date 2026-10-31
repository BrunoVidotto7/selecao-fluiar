import { host } from '@/lib/format';

// Links de loja em "chips", com a observação ao lado (igual à página original)
export default function ItemLinks({ links, empty }) {
  if (!links.length) return <div className="links"><span className="ro-none">{empty}</span></div>;
  return (
    <div className="links">
      {links.map(([url, note], i) => (
        <div className="lk" key={i}>
          <span className="chip"><a href={url} target="_blank" rel="noopener noreferrer" title={url}>{host(url)} ↗</a></span>
          {note && <span className="ro-note">{note}</span>}
        </div>
      ))}
    </div>
  );
}
