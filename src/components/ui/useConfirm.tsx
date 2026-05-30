/**
 * useConfirm — hook que retorna uma função async pra confirmar ações.
 *
 * Substitui `window.confirm()` por modal estilizado, mantendo a mesma API
 * imperativa (1 linha de código, sem state boilerplate).
 *
 * Uso:
 *   const confirm = useConfirm();
 *   if (!await confirm({ title: 'Excluir?', message: '...', danger: true })) return;
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (pending) {
      pending.resolve(true);
      setPending(null);
    }
  };

  const handleCancel = () => {
    if (pending) {
      pending.resolve(false);
      setPending(null);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        variant={pending?.danger ? 'danger' : 'default'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback gracioso: cai pro confirm nativo se Provider não montado
    return (opts: ConfirmOptions) => {
      const msg = [opts.title, opts.message].filter(Boolean).join('\n\n');
      return Promise.resolve(window.confirm(msg));
    };
  }
  return ctx;
}
