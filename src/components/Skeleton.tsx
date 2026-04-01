interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const BASE = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 8,
  animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
} as const;

/** Single skeleton line */
export function SkeletonLine({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`h-3 rounded ${className}`}
      style={{ ...BASE, ...style }}
    />
  );
}

/** Card-shaped skeleton block */
export function SkeletonCard({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl p-4 flex flex-col gap-3 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', ...style }}
    >
      <div style={{ ...BASE, height: 10, width: '40%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 24, width: '60%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 8, width: '30%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 4, borderRadius: 99, marginTop: 4 }} />
    </div>
  );
}

/** Chart-area sized skeleton */
export function SkeletonChart({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-4 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...style }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div style={{ ...BASE, height: 8, width: 120, borderRadius: 6 }} />
          <div style={{ ...BASE, height: 28, width: 80, borderRadius: 6 }} />
        </div>
        <div style={{ ...BASE, height: 22, width: 50, borderRadius: 8 }} />
      </div>
      {/* Fake bars */}
      <div className="flex items-end gap-2 h-24">
        {[60, 80, 45, 90, 70, 55, 85, 75].map((h, i) => (
          <div
            key={i}
            style={{ ...BASE, flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m) => (
          <div key={m} style={{ ...BASE, height: 7, width: 20, borderRadius: 4 }} />
        ))}
      </div>
    </div>
  );
}

/** Map-area sized skeleton */
export function SkeletonMap({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`w-full h-full rounded-xl flex items-center justify-center ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div style={{ ...BASE, width: 48, height: 48, borderRadius: '50%' }} />
        <div style={{ ...BASE, width: 120, height: 10, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// Global keyframe injected once
const STYLE = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`;
if (typeof document !== 'undefined' && !document.getElementById('skeleton-kf')) {
  const s = document.createElement('style');
  s.id = 'skeleton-kf';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

export default { SkeletonLine, SkeletonCard, SkeletonChart, SkeletonMap };
