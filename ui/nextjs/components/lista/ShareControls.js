'use client';
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import Button from '../ui/Button';
import { TextInput } from '../ui/Fields';
import { useConfirm, useToast } from '../feedback/Feedback';
import { rotateShareToken } from './actions';

const COPY_FAILED_DETAIL = 'Não conseguimos copiar automaticamente. Selecione o link e copie manualmente.';
const ROTATION_FAILED_DETAIL = 'Não conseguimos gerar um novo link. Tente novamente.';
const ROTATION_WARNING = 'O link anterior deixará de funcionar. Envie o novo link ao perfil após a alteração.';

/** @param {{ listId: string, shareToken: string }} props */
export default function ShareControls({ listId, shareToken }) {
  return <ShareControlsContent key={listId} listId={listId} shareToken={shareToken} />;
}

function ShareControlsContent({ listId, shareToken }) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const mounted = useRef(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  const [localToken, setLocalToken] = useState(null);
  const token = localToken ?? shareToken;
  const currentOwnership = useRef({ localToken, token });
  const url = `${origin}/l/${token}`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Confirmation must use the currently owned token.
  useEffect(() => {
    currentOwnership.current = { localToken, token };
  }, [localToken, token]);

  // Keep the returned token until refreshed props acknowledge it.
  useEffect(() => {
    if (!busy && shareToken === localToken) setLocalToken(null);
  }, [busy, shareToken, localToken]);

  const copy = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const browserOrigin = window.location.origin;
    setOrigin(browserOrigin);
    try {
      if (window.isSecureContext === false || !navigator.clipboard?.writeText) {
        toast(COPY_FAILED_DETAIL, 'err');
        return;
      }
      await navigator.clipboard.writeText(`${browserOrigin}/l/${token}`);
      if (mounted.current) toast('Link copiado.');
    } catch {
      if (mounted.current) toast(COPY_FAILED_DETAIL, 'err');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const requestRotation = () => {
    if (pending.current) return;
    setOrigin(window.location.origin);
    confirm({
      title: 'Gerar novo link?',
      text: ROTATION_WARNING,
      confirmLabel: 'Gerar novo link',
      onConfirm: async () => {
        if (!mounted.current || pending.current) return;
        const { localToken: previousLocalToken, token: currentToken } = currentOwnership.current;
        pending.current = true;
        setBusy(true);
        setLocalToken(currentToken);
        try {
          const result = await rotateShareToken(listId);
          if (!mounted.current) return;
          if (!result.ok) {
            setLocalToken(previousLocalToken);
            toast(result.detail, 'err');
            return;
          }
          setLocalToken(result.data.shareToken);
          toast('Novo link gerado. O link anterior deixou de funcionar.');
          router.refresh();
        } catch (error) {
          if (mounted.current) {
            unstable_rethrow(error);
            setLocalToken(previousLocalToken);
            toast(ROTATION_FAILED_DETAIL, 'err');
          }
        } finally {
          pending.current = false;
          if (mounted.current) setBusy(false);
        }
      },
    });
  };

  return (
    <section aria-label="Compartilhar lista" style={{ marginTop: 18 }}>
      <TextInput id={`list-link-${listId}`} label="Link da lista" value={url} readOnly
        hint="O acesso exige login e permissão para esta lista."
        onFocus={(event) => event.target.select()} onClick={(event) => event.currentTarget.select()} />
      <div className="listbar">
        <div className="btns">
          <Button variant="ghost" size="sm" disabled={busy} onClick={copy}>Copiar link</Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={requestRotation}>Gerar novo link</Button>
        </div>
      </div>
    </section>
  );
}
