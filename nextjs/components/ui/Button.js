import Link from 'next/link';
import Icon from './Icon';

const VARIANTS = { primary: 'btn', ghost: 'btn btn-ghost', danger: 'btn btn-danger', text: 'btn btn-text', 'text-danger': 'btn btn-text danger' };

// Botão em pílula (estilo do "Ver como cliente" da lista original).
// Com href vira link; sem href, <button>.
export default function Button({ href, variant = 'primary', size, block, icon, busy, className = '', children, ...props }) {
  const cls = [VARIANTS[variant], size === 'sm' && 'btn-sm', block && 'btn-block', className].filter(Boolean).join(' ');
  const content = <>{icon && <Icon name={icon} />}{children}</>;
  if (href) return <Link className={cls} href={href} {...props}>{content}</Link>;
  return <button className={cls} type="button" aria-busy={busy ? 'true' : undefined} {...props}>{content}</button>;
}

export function IconButton({ href, icon, label, danger, ...props }) {
  const cls = 'iconbtn' + (danger ? ' danger' : '');
  if (href) return <Link className={cls} href={href} aria-label={label} {...props}><Icon name={icon} /></Link>;
  return <button type="button" className={cls} aria-label={label} {...props}><Icon name={icon} /></button>;
}
