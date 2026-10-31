'use client';
// Avisos (toast) e modal de confirmação de exclusão, disponíveis em todas as telas.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '../ui/Icon';

const ToastCtx = createContext(() => {});
const ConfirmCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export const useConfirm = () => useContext(ConfirmCtx);

// Guarda um aviso para mostrar na próxima tela (ex.: "Cliente salvo." depois de redirecionar)
export function flash(message, type) {
  try { sessionStorage.setItem('flash', JSON.stringify({ m: message, t: type })); } catch {}
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const okRef = useRef(null);
  const lastFocus = useRef(null);
  const pathname = usePathname();

  const toast = useCallback((message, type) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, out: true } : x))), 2600);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2950);
  }, []);

  useEffect(() => {
    try {
      const f = sessionStorage.getItem('flash');
      if (f) { sessionStorage.removeItem('flash'); const p = JSON.parse(f); setTimeout(() => toast(p.m, p.t), 200); }
    } catch {}
  }, [pathname, toast]);

  const confirm = useCallback((opts) => { lastFocus.current = document.activeElement; setDialog(opts); }, []);
  const close = () => { setDialog(null); lastFocus.current?.focus?.(); };

  useEffect(() => {
    if (!dialog) return;
    okRef.current?.previousSibling?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog]);

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={'toast' + (t.type === 'err' ? ' err' : '') + (t.out ? ' out' : '')}>
              <Icon name={t.type === 'err' ? 'alert' : 'check'} /><span>{t.message}</span>
            </div>
          ))}
        </div>
        {dialog && (
          <div className="modal">
            <div className="scrimm" onClick={close} />
            <div className="box" role="alertdialog" aria-modal="true" aria-labelledby="m-t" aria-describedby="m-d">
              <span className="art"><Icon name="trash" /></span>
              <h2 id="m-t">{dialog.title}</h2>
              <p id="m-d">{dialog.text || 'Essa ação não pode ser desfeita.'}</p>
              <div className="btns">
                <button className="btn btn-ghost" type="button" onClick={close}>Cancelar</button>
                <button ref={okRef} className="btn btn-danger" type="button" onClick={() => { const fn = dialog.onConfirm; setDialog(null); fn?.(); }}>
                  {dialog.confirmLabel || 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
