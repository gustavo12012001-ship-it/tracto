/**
 * Toast — sistema global de notificações da Tracto.
 *
 * Uso:
 *   import { toast } from './components/ui/Toast';
 *   toast.success('Salvo!');
 *   toast.error('Erro ao salvar.');
 *   toast.info('Imagem em fila.');
 *
 * Wrapper do <ToastProvider /> deve estar montado em Layout.
 */
import { useEffect, useState, useCallback } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: ToastListener[] = [];
  private nextId = 1;

  subscribe(listener: ToastListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l([...this.toasts]);
  }

  show(variant: ToastVariant, message: string, duration = 4000): number {
    const id = this.nextId++;
    this.toasts.push({ id, variant, message, duration });
    this.emit();
    setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  dismiss(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  success(msg: string, duration?: number) { return this.show('success', msg, duration); }
  error(msg: string, duration?: number)   { return this.show('error', msg, duration ?? 6000); }
  info(msg: string, duration?: number)    { return this.show('info', msg, duration); }
  warning(msg: string, duration?: number) { return this.show('warning', msg, duration); }
}

export const toast = new ToastManager();

const VARIANT_STYLES: Record<ToastVariant, { icon: string; color: string; bg: string }> = {
  success: { icon: 'check_circle', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  error:   { icon: 'error',        color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  info:    { icon: 'info',         color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  warning: { icon: 'warning',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
};

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe(setToasts);
  }, []);

  const dismiss = useCallback((id: number) => toast.dismiss(id), []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notificações"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[5000] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 'calc(100vw - 2rem)' }}>
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            className="glass-overlay flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto min-w-[280px] max-w-md animate-toast-in"
            style={{ borderLeft: `3px solid ${style.color}` }}>
            <span
              className="material-symbols-outlined flex-shrink-0"
              style={{ color: style.color, fontSize: 20 }}
              aria-hidden="true">
              {style.icon}
            </span>
            <p className="flex-1 text-sm" style={{ color: 'var(--text)' }}>{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fechar notificação"
              className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>close</span>
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-toast-in { animation: toast-in 250ms ease-out; }
      `}</style>
    </div>
  );
}

export default ToastProvider;
