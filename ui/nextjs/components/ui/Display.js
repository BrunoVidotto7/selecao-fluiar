import Link from 'next/link';
import Icon from './Icon';
import { initials, pct } from '@/lib/format';

export function PageHeader({ eyebrow, crumbs, title, meta, actions }) {
  return (
    <div className="pagehead">
      <div>
        {crumbs ? <Crumbs items={crumbs} /> : eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {meta && <p className="meta" style={{ margin: 0 }}>{meta}</p>}
      </div>
      {actions && <div className="btns">{actions}</div>}
    </div>
  );
}

// items: [{ href, label }] — o último é a página atual
export function Crumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Caminho">
      {items.map((c, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty">
      <span className="art"><Icon name={icon} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export const Avatar = ({ name, large }) => <span className={'avatar' + (large ? ' lg' : '')}>{initials(name)}</span>;

export const Progress = ({ total, done, style }) => (
  <div className="progress" style={style}><i style={{ width: `${pct(total, done)}%` }} /></div>
);

/** @param {{ total: number, done: number, completed: boolean }} props */
export function StatusBadge({ total, done, completed }) {
  return completed
    ? <span className="badge badge-done">Concluída</span>
    : <span className="badge badge-pend">{total === 0 ? 'Sem produtos' : `${total - done} pendentes`}</span>;
}

export function StatCard({ href, label, value, detail, highlight }) {
  const inner = <><span className="k">{label}</span><span className="v">{value}</span>{detail && <span className="d">{detail}</span>}</>;
  const cls = 'card stat' + (highlight ? ' hl' : '');
  return href ? <Link className={cls} href={href}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export function Alert({ type = 'err', children, ...props }) {
  return (
    <div className={`alert alert-${type}`} role="alert" tabIndex={-1} {...props}>
      <Icon name={type === 'err' ? 'alert' : 'check'} /><span>{children}</span>
    </div>
  );
}

// Título no estilo da lista original: "Lista de compras <em>da casa</em>"
export const Title = ({ children, em }) => <>{children}{em && <> <em>{em}</em></>}</>;
