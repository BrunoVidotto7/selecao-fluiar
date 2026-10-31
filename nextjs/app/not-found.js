import Button from '@/components/ui/Button';
export default function NotFound() {
  return (
    <main className="main"><div className="wrap narrow">
      <div className="empty"><h3>Página não encontrada</h3><p>O endereço pode ter mudado ou o item foi excluído.</p><Button href="/dashboard">Ir para o Dashboard</Button></div>
    </div></main>
  );
}
