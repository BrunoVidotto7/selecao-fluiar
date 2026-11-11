import Link from 'next/link';

// Telas de acesso: painel da marca à esquerda (topo no celular) e formulário à direita.
export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Link className="logo" href="/login">FLUIAR<small>Seleção</small></Link>
        <div>
          <blockquote>Cada item <em>no seu lugar.</em></blockquote>
          <p className="cap">Organize as listas de compras dos seus perfis por ambiente, com links das lojas, observações e o que já foi comprado.</p>
        </div>
        <div className="ticket" aria-hidden="true">
          <div><span className="tick on" /><s>Capacho de sisal</s></div>
          <div><span className="tick on" /><s>Espremedor de laranja elétrico</s></div>
          <div><span className="tick" />Batedeira · 3 opções</div>
          <div><span className="tick" />2 cadeiras giratórias</div>
        </div>
      </aside>
      <main className="auth-main" id="main"><div className="auth-box">{children}</div></main>
    </div>
  );
}
