/**
 * EmptyState — componente único de "nenhum dado" da Tracto.
 * Substitui ~30+ versões espalhadas de "Nenhum X cadastrado".
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'compact';
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  const padding = variant === 'compact' ? 'py-6' : 'py-12';
  const iconSize = variant === 'compact' ? 'text-3xl' : 'text-5xl';

  return (
    <div className={`flex flex-col items-center justify-center px-6 ${padding} text-center`}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(236,91,19,0.10)' }}>
        <span className={`material-symbols-outlined ${iconSize}`} style={{ color: 'var(--primary)' }} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>{title}</p>
      {description && (
        <p className="text-xs leading-relaxed max-w-xs mb-4" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export default EmptyState;
