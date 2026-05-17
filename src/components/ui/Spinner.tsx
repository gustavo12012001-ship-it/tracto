/**
 * Spinner — componente único de loading da Tracto.
 * Substitui ~47 ocorrências de `animate-spin` inline espalhadas pelo código.
 */

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'muted';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

const COLOR_MAP = {
  primary: 'border-orange-500/30 border-t-orange-500',
  white: 'border-white/30 border-t-white',
  muted: 'border-slate-500/30 border-t-slate-500',
};

export function Spinner({ size = 'sm', color = 'primary', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`inline-block rounded-full animate-spin ${SIZE_MAP[size]} ${COLOR_MAP[color]} ${className}`}
    />
  );
}

export function SpinnerWithText({ text = 'Carregando…', size = 'md' }: { text?: string; size?: SpinnerProps['size'] }) {
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <Spinner size={size} />
      <span className="text-sm" style={{ color: 'var(--muted)' }}>{text}</span>
    </div>
  );
}

export default Spinner;
