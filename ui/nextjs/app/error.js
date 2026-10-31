'use client';
import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function ErrorPage({ reset }) {
  const router = useRouter();
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="empty">
      <h1>Não conseguimos carregar esta página.</h1>
      <Button onClick={retry}>Tentar novamente</Button>
    </div>
  );
}
