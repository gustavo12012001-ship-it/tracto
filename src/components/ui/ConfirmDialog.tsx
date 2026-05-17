/**
 * ConfirmDialog — modal de confirmação estilizado (substitui window.confirm nativo).
 *
 * Uso:
 *   const [openDel, setOpenDel] = useState(false);
 *   <ConfirmDialog
 *     open={openDel}
 *     title="Excluir talhão?"
 *     message="Esta ação não pode ser desfeita."
 *     confirmLabel="Excluir"
 *     variant="danger"
 *     onConfirm={() => { delete(); setOpenDel(false); }}
 *     onCancel={() => setOpenDel(false)}
 *   />
 */
import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
      if (e.key === 'Enter' && !loading) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel, onConfirm]);

  if (!open) return null;

  const dangerStyle = variant === 'danger';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => !loading && onCancel()}>
      <div
        className="glass-overlay rounded-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: dangerStyle ? 'rgba(239,68,68,0.15)' : 'rgba(236,91,19,0.15)' }}>
            <span
              className="material-symbols-outlined"
              style={{ color: dangerStyle ? '#f87171' : '#ec5b13' }}
              aria-hidden="true">
              {dangerStyle ? 'warning' : 'help'}
            </span>
          </div>
          <div className="flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-black" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
            {message && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            style={{
              background: dangerStyle ? '#ef4444' : 'var(--primary)',
              boxShadow: dangerStyle ? '0 2px 12px rgba(239,68,68,0.35)' : '0 2px 12px rgba(236,91,19,0.35)',
            }}>
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
