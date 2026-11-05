'use client';
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Textarea } from '../ui/Fields';
import Button from '../ui/Button';
import { useToast } from '../feedback/Feedback';
import { validateClientNotes } from '@/lib/validation';

const SAVE_FAILED_DETAIL = 'Não conseguimos salvar agora. Tente novamente.';

export default function ProductClientNotesEditor(props) {
  return <NotesEditor key={props.productId} {...props} />;
}

function NotesEditor({ productId, productName, clientNotes, onSave }) {
  const [draft, setDraft] = useState(clientNotes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef(clientNotes ?? '');
  const baseline = useRef(clientNotes ?? '');
  const pending = useRef(false);
  const mounted = useRef(true);
  const toast = useToast();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const incoming = clientNotes ?? '';
    const previous = baseline.current;
    baseline.current = incoming;
    if (current.current === previous) {
      current.current = incoming;
      setDraft(incoming);
    }
  }, [clientNotes]);

  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const submitted = current.current;
    const message = validateClientNotes(submitted);
    setError(message);
    if (message) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await onSave(submitted.trim() || null);
      if (!mounted.current) return;
      if (!result.ok) {
        setError(result.errors?.clientNotes || '');
        toast(result.detail, 'err');
        return;
      }
      const saved = result.data.clientNotes ?? '';
      baseline.current = saved;
      if (current.current === submitted) {
        current.current = saved;
        setDraft(saved);
      }
      toast('Observação salva.');
    } catch (failure) {
      if (!mounted.current) return;
      unstable_rethrow(failure);
      toast(SAVE_FAILED_DETAIL, 'err');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return <form className="form" onSubmit={submit} noValidate style={{ marginTop: 12 }}>
    <Textarea id={`client-notes-${productId}`} label="Observação do cliente"
      aria-label={`Observação do cliente: ${productName}`} value={draft} error={error} rows={2}
      onChange={(event) => { current.current = event.target.value; setDraft(event.target.value); setError(''); }} />
    <Button type="submit" variant="ghost" size="sm" busy={busy} aria-label={`Salvar observação de ${productName}`}>
      {busy ? 'Salvando…' : 'Salvar observação'}
    </Button>
  </form>;
}
