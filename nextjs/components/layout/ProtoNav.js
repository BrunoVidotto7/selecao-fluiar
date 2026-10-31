'use client';
// Navegador de telas do protótipo, para avaliar o design. Remover em produção.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '../ui/Icon';

const GROUPS = [
  ['Acesso', [['/login', 'Login'], ['/login?estado=erro', 'Login', 'com erro'], ['/cadastro', 'Cadastro de usuário'], ['/recuperar-senha', 'Recuperar senha'], ['/recuperar-senha?estado=enviado', 'Recuperar senha', 'enviado'], ['/nova-senha', 'Nova senha']]],
  ['Sistema', [['/dashboard', 'Dashboard'], ['/clientes', 'Clientes'], ['/clientes/novo', 'Novo cliente'], ['/clientes/sergio-hooper/editar', 'Editar cliente'], ['/clientes/sergio-hooper', 'Detalhes do cliente'], ['/listas', 'Listas de compras'], ['/listas/nova', 'Nova lista'], ['/listas/lista-da-casa/editar', 'Editar lista'], ['/listas/lista-da-casa', 'Lista de compras'], ['/listas/lista-da-casa/produtos/novo', 'Novo produto'], ['/listas/lista-da-casa/produtos/p4/editar', 'Editar produto'], ['/configuracoes', 'Configurações']]],
  ['Estados vazios', [['/dashboard?estado=vazio', 'Dashboard', 'vazio'], ['/clientes?estado=vazio', 'Clientes', 'vazio'], ['/clientes/sergio-hooper?estado=vazio', 'Cliente sem listas', 'vazio'], ['/listas?estado=vazio', 'Listas', 'vazio'], ['/listas/lista-da-casa?estado=vazio', 'Lista sem produtos', 'vazio']]],
];

export default function ProtoNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  return (
    <div className="proto" ref={ref}>
      {open && (
        <div className="panel" id="proto-panel">
          {GROUPS.map(([g, items]) => (
            <div key={g}>
              <b>{g}</b>
              {items.map(([href, label, tag]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)}>{label}{tag && <small>{tag}</small>}</Link>
              ))}
            </div>
          ))}
        </div>
      )}
      <button type="button" aria-expanded={open} aria-controls="proto-panel" onClick={() => setOpen(!open)}><Icon name="layers" />Telas</button>
    </div>
  );
}
