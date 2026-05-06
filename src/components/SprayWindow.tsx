import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { WeatherCache } from '../store/useAppStore';

interface SprayWindowResult {
  status: 'GO' | 'CAUTION' | 'NO_GO';
  score: number;
  reasons: string[];
  favorable: string[];
  best_window: string;
  checklist: Array<{ item: string; ok: boolean }>;
}

interface Props {
  weatherCache: WeatherCache | null;
}

const STATUS_CONFIG = {
  GO: {
    label: 'PODE APLICAR',
    icon: 'check_circle',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.2)',
  },
  CAUTION: {
    label: 'ATENÇÃO',
    icon: 'warning',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  NO_GO: {
    label: 'NÃO APLICAR',
    icon: 'cancel',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
  },
};

export default function SprayWindow({ weatherCache }: Props) {
  const [result, setResult] = useState<SprayWindowResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!weatherCache) return;
    setLoading(true);

    const rain6h = weatherCache.hourly.precip.slice(0, 6).reduce((a, b) => a + b, 0);
    const rain24h = weatherCache.hourly.precip.reduce((a, b) => a + b, 0);

    apiFetch<SprayWindowResult>('/api/weather/spray-window', {
      method: 'POST',
      body: JSON.stringify({
        wind_speed: weatherCache.windSpeed,
        humidity: weatherCache.humidity,
        temperature: weatherCache.temperature,
        rain_next_6h: rain6h,
        rain_next_24h: rain24h,
        weather_code: weatherCache.weatherCode,
      }),
    })
      .then(setResult)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [weatherCache]);

  if (!weatherCache) return null;

  const cfg = result ? STATUS_CONFIG[result.status] : null;

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>water_drop</span>
        <h3 className="font-bold text-white text-base">Janela de Pulverização</h3>
        <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>Condições agora</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2" style={{ color: 'var(--muted)' }}>
          <div className="w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <span className="text-sm">Avaliando condições...</span>
        </div>
      )}

      {!loading && result && cfg && (
        <div className="flex flex-col gap-3">
          {/* Semáforo principal */}
          <div className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <span className="material-symbols-outlined text-4xl" style={{ color: cfg.color }}>
              {cfg.icon}
            </span>
            <div>
              <p className="text-xl font-black" style={{ color: cfg.color }}>{cfg.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{result.best_window}</p>
            </div>
            {/* Score */}
            <div className="ml-auto text-right">
              <p className="text-2xl font-black" style={{ color: cfg.color }}>{result.score}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>/ 100</p>
            </div>
          </div>

          {/* Barra de score */}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${result.score}%`,
                background: result.score >= 65 ? '#22c55e' : result.score >= 35 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>

          {/* Checklist */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.checklist.map((item) => (
              <div key={item.item}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                style={{
                  background: item.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${item.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}>
                <span className="material-symbols-outlined text-sm"
                  style={{ color: item.ok ? '#22c55e' : '#ef4444' }}>
                  {item.ok ? 'check' : 'close'}
                </span>
                <span style={{ color: item.ok ? '#22c55e' : '#ef4444' }}>{item.item}</span>
              </div>
            ))}
          </div>

          {/* Restrições */}
          {result.reasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#f87171' }}>
                Restrições
              </p>
              <div className="flex flex-col gap-1">
                {result.reasons.map((r) => (
                  <div key={r} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.06)', color: '#f87171' }}>
                    <span className="material-symbols-outlined text-sm flex-shrink-0">cancel</span>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condições favoráveis */}
          {result.favorable.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4ade80' }}>
                Condições favoráveis
              </p>
              <div className="flex flex-col gap-1">
                {result.favorable.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(34,197,94,0.06)', color: '#4ade80' }}>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !result && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>
          Dados meteorológicos insuficientes para avaliação.
        </p>
      )}
    </div>
  );
}
