'use client';
// Estrutura das telas internas: menu lateral (desktop) e gaveta com topo fixo (tablet/celular).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { logout } from '../auth/actions';
import { initials } from '@/lib/format';
import { keepFocusInside } from '@/lib/focus';

// Mesmo ponto de quebra do CSS em que o menu vira gaveta sobre a página.
const DRAWER_MEDIA = '(max-width: 960px)';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/clientes', label: 'Clientes', icon: 'users' },
  { href: '/listas', label: 'Listas de compras', icon: 'list' },
  { href: '/configuracoes', label: 'Configurações', icon: 'gear' },
];

export default function AppShell({ user, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const openBtn = useRef(null);
  const firstLink = useRef(null);
  const sideRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); openBtn.current?.focus(); }
      if (window.matchMedia(DRAWER_MEDIA).matches) keepFocusInside(e, sideRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const active = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="shell">
      <a className="skip" href="#main">Pular para o conteúdo</a>
      <header className="topbar">
        <Link className="logo" href="/dashboard">FLUIAR</Link>
        <button ref={openBtn} className="iconbtn" aria-label="Abrir menu" aria-controls="side" aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
      </header>
      <aside ref={sideRef} className={'side' + (open ? ' open' : '')} id="side" aria-label="Menu principal">
        <button className="iconbtn close" aria-label="Fechar menu" onClick={() => { setOpen(false); openBtn.current?.focus(); }}><Icon name="x" /></button>
        <Link className="logo" href="/dashboard">FLUIAR<small>Seleção</small></Link>
        <nav className="nav">
          {NAV.map((n, i) => (
            <Link key={n.href} ref={i === 0 ? firstLink : undefined} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>
              <Icon name={n.icon} />{n.label}
            </Link>
          ))}
        </nav>
        <div className="me">
          <div className="me-card"><span className="avatar">{initials(user.name)}</span><div><b>{user.name}</b><span>{user.officeName}</span></div></div>
          <form className="nav" action={logout}><Button type="submit" variant="text" className="out" icon="out" style={{ justifyContent: 'flex-start' }}>Sair</Button></form>
        </div>
      </aside>
      <div className={'scrim' + (open ? ' open' : '')} onClick={() => setOpen(false)} />
      <main className="main" id="main">{children}</main>
    </div>
  );
}
