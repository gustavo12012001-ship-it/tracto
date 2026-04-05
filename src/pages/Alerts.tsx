import { useCallback, useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import type { Alert } from '../store/useAppStore';
import { FALLBACK_LOCATION } from '../utils/geolocation';

import { useNavigate } from 'react-router-dom';

// ── Alert type colors ─────────────────────────────────────────────────────────
const TYPE_STYLE: Record<Alert['type'], { border: string; badge: string; badgeText: string }> = {
  critical: {
    border: 'border-orange-500',
    badge: 'bg-orange-500/20 text-orange-400',
    badgeText: 'ALERTA CRÍTICO',
  },
  warning: {
    border: 'border-amber-500',
    badge: 'bg-amber-500/20 text-amber-400',
    badgeText: 'AVISO',
  },
  info: {
    border: 'border-blue-500',
    badge: 'bg-blue-500/20 text-blue-400',
    badgeText: 'INFORMATIVO',
  },
};

const TYPE_VALUE_COLOR: Record<Alert['type'], string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#60a5fa',
};

// ── Extra fields added by alertsAI ───────────────────────────────────────────
interface AlertExtra extends Alert {
  field?: string;
  value?: string;
  valueLabel?: string;
}

function mapSnapshotAlerts(rawAlerts: Array<Record<string, unknown>>): Alert[] {
  const now = Date.now();
  return rawAlerts.map((item, index) => {
    const createdAt = typeof item.createdAt === 'string' ? Date.parse(item.createdAt) : now;
    const normalizedType = item.type === 'critical' || item.type === 'warning' || item.type === 'info'
      ? item.type
      : 'info';

    return {
      id: String(item.id ?? `snapshot-alert-${index}`),
      type: normalizedType,
      title: String(item.title ?? 'Alerta agronômico'),
      message: String(item.message ?? ''),
      timestamp: Number.isFinite(createdAt) ? createdAt : now,
      dismissed: false,
      field: typeof item.field === 'string' ? item.field : undefined,
      value: item.value != null ? String(item.value) : undefined,
      valueLabel: typeof item.valueLabel === 'string' ? item.valueLabel : undefined,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Alerts() {
  const navigate = useNavigate();
  const {
    currentLocation,
    fields,
    weatherCache,
    alerts,
    setAlerts,
    dismissAlert,
    activeFieldId,
    fieldIntelligenceById,
    fetchFieldIntelligence,
  } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoLoad = useRef(false);
  

  const activeField = activeFieldId
    ? fields.find((field) => field.id === activeFieldId) ?? null
    : null;

  const loc = activeField
    ? activeField
    : (currentLocation || FALLBACK_LOCATION);
  const snapshot = activeFieldId ? fieldIntelligenceById[activeFieldId] : null;

  const visibleAlerts = (alerts as AlertExtra[]).filter((a) => !a.dismissed);
  const criticalCount = visibleAlerts.filter((a) => a.type === 'critical').length;
  const warningCount = visibleAlerts.filter((a) => a.type === 'warning').length;
  const infoCount = visibleAlerts.filter((a) => a.type === 'info').length;

  // Alertas locais gerados automaticamente quando não há talhões
  const getLocalAlerts = () => {
    if (!weatherCache) return [];
    const local = [];
    if (weatherCache.temperature > 32) {
      local.push({ id: 'l1', type: 'warning' as const, title: 'Calor intenso', message: 'Atenção ao estresse hídrico das culturas.' });
    }
    if ((weatherCache.daily.precipSum[0] ?? 0) > 20) {
      local.push({ id: 'l2', type: 'info' as const, title: 'Chuva significativa prevista', message: 'Avalie condições de pulverização.' });
    }
    if (weatherCache.windSpeed > 20) {
      local.push({ id: 'l3', type: 'warning' as const, title: 'Vento forte', message: 'Evite pulverizações hoje.' });
    }
    if (local.length === 0) {
      local.push({ id: 'l4', type: 'info' as const, title: 'Condições favoráveis', message: `Temperatura atual: ${Math.round(weatherCache.temperature)}°C, Umidade: ${weatherCache.humidity}%` });
    }
    return local;
  };
  const localAlerts = getLocalAlerts();

  const loadAlerts = useCallback(async () => {
    if (!activeFieldId) {
      setError('Selecione um talhão ativo para carregar os alertas consolidados.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const intelligence = await fetchFieldIntelligence(activeFieldId, true);
      const generated = intelligence?.alerts ? mapSnapshotAlerts(intelligence.alerts) : [];
      setAlerts(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar alertas');
    } finally {
      setLoading(false);
    }
  }, [activeFieldId, fetchFieldIntelligence, setAlerts]);

  // Auto-load when mounting if no alerts yet
  useEffect(() => {
    didAutoLoad.current = false;
    if (!activeFieldId) return;
    void loadAlerts();
  }, [activeFieldId, loadAlerts]);

  useEffect(() => {
    if (didAutoLoad.current) return;

    if (alerts.length === 0 && activeFieldId) {
      didAutoLoad.current = true;
      void loadAlerts();
    }
  }, [alerts.length, activeFieldId, loadAlerts]);

  return (
    <>
      <style>{`
        .glass-card-alert {
          background: rgba(38, 28, 24, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(236, 91, 19, 0.1);
        }
        .alert-scrollbar::-webkit-scrollbar { width: 6px; }
        .alert-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .alert-scrollbar::-webkit-scrollbar-thumb { background: #3d2a22; border-radius: 10px; }
      `}</style>

      <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="flex-1 overflow-y-auto alert-scrollbar p-10">

          {/* ── Header + Reload ── */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-white font-bold text-xl">Alertas Inteligentes</h1>
              <p className="text-slate-400 text-xs mt-1">
                Snapshot do talhão ativo · {loc?.name ?? 'Localização atual'}
              </p>
              {snapshot && (
                <p className="text-slate-500 text-[11px] mt-1">
                  Alertas atualizados em: {snapshot.updated_at ? new Date(snapshot.updated_at).toLocaleString('pt-BR') : 'N/D'}
                </p>
              )}
            </div>
            <button
              onClick={loadAlerts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.3)' }}
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'refresh' : 'smart_toy'}
              </span>
              {loading ? 'Analisando...' : 'Atualizar talhão'}
            </button>
          </div>

          {/* ── No fields message ── */}
          {fields.length === 0 && !loading && (
            <>
              <div className="glass-card-alert rounded-2xl p-8 text-center mb-8" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: '#ec5b13' }}>map</span>
                <h3 className="text-white font-bold mb-2">Nenhum talhão cadastrado</h3>
                <p className="text-slate-400 text-sm">Vá até o <span className="text-white font-semibold">Mapa / Talhões</span> e desenhe seu primeiro talhão para ativar os alertas de IA.</p>
              </div>

              {localAlerts.length > 0 && (
                <>
                  <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-xl">wb_sunny</span>
                    Clima em sua região
                  </h3>
                  <div className="grid grid-cols-1 gap-4 mb-8">
                    {localAlerts.map((a) => {
                      const st = TYPE_STYLE[a.type];
                      return (
                        <div key={a.id} className={`glass-card-alert rounded-xl overflow-hidden flex flex-col items-stretch border-l-4 ${st.border}`}>
                          <div className="p-6">
                            <div className="flex flex-col gap-2">
                              <span className={`px-2 py-0.5 ${st.badge} text-[10px] font-bold rounded uppercase w-fit`}>
                                {st.badgeText}
                              </span>
                              <h4 className="text-slate-100 text-base font-bold">{a.title}</h4>
                              <p className="text-slate-400 text-sm">{a.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Empty state (No alerts from AI) ── */}
          {!loading && alerts.length === 0 && fields.length > 0 && !error && (
            <div className="glass-card-alert rounded-2xl p-10 text-center mb-8" style={{ border: '1px solid rgba(74, 222, 128, 0.2)', background: 'rgba(74, 222, 128, 0.03)' }}>
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-green-500">task_alt</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Sua lavoura está protegida</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Nenhuma anomalia crítica foi detectada pela nossa IA nos seus talhões monitorados no momento.
              </p>
              <button 
                onClick={loadAlerts}
                className="mt-6 text-green-400 text-xs font-bold uppercase tracking-widest hover:text-green-300 transition-colors"
              >
                Refazer análise agora
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="p-4 rounded-xl flex items-start gap-3 mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
              <div>
                <p className="text-sm text-red-300 font-semibold">Erro ao gerar alertas</p>
                <p className="text-xs text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="space-y-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card-alert rounded-xl h-36 animate-pulse" style={{ borderLeft: '4px solid #ec5b13' }} />
              ))}
            </div>
          )}

          {/* ── Summary row ── */}
          {!loading && visibleAlerts.length > 0 && (
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              {[
                { label: 'Críticos', count: criticalCount, icon: 'warning', borderColor: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
                { label: 'Avisos', count: warningCount, icon: 'warning', borderColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
                { label: 'Informativos', count: infoCount, icon: 'info', borderColor: '#60a5fa', bgColor: 'rgba(96,165,250,0.1)' },
              ].map(({ label, count, icon, borderColor, bgColor }) => (
                <div key={label} className="glass-card-alert rounded-xl overflow-hidden flex items-stretch p-4 flex-1" style={{ borderLeft: `4px solid ${borderColor}` }}>
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: bgColor }}>
                      <span className="material-symbols-outlined" style={{ color: borderColor }}>{icon}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
                      <p className="text-2xl font-bold text-slate-100">{String(count).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Alerts feed ── */}
          {!loading && visibleAlerts.length > 0 && (
            <>
              <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-xl">feed</span>
                Feed de Atividades em Tempo Real
              </h3>

              {criticalCount > 0 && (
                <div className="glass-card-alert rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-l-4 border-orange-500/50" style={{ background: 'rgba(236,91,19,0.05)' }}>
                  <div>
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500">satellite_alt</span>
                      Alerta crítico detectado
                    </h4>
                    <p className="text-slate-400 text-sm mt-1">Analise o talhão via satélite para localizar a área afetada.</p>
                  </div>
                  <button
                    onClick={() => navigate('/app')}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all flex-shrink-0"
                  >
                    Analisar no Dashboard
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {visibleAlerts.map((alert) => {
                  const a = alert as AlertExtra;
                  const st = TYPE_STYLE[a.type];
                  return (
                    <div
                      key={a.id}
                      className={`glass-card-alert rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch border-l-4 ${st.border}`}
                    >
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 ${st.badge} text-[10px] font-bold rounded uppercase`}>
                                {st.badgeText}
                              </span>
                                <span className="text-slate-500 text-[11px] font-medium tracking-tight">
                                  {a.field ? `${a.field} · ` : ''}{new Date(a.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {(a.id.startsWith('A') || a.id.startsWith('M')) && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-bold rounded border border-green-500/20">
                                    <span className="material-symbols-outlined text-[10px]">verified</span>
                                    FONTE: MOTOR DETERMINÍSTICO
                                  </span>
                                )}
                              </div>
                            <h4 className="text-slate-100 text-lg font-bold">{a.title}</h4>
                            <p className="text-slate-400 text-sm mt-2 max-w-2xl">{a.message}</p>
                          </div>
                          {a.value && (
                            <div className="text-left xl:text-right w-full xl:w-auto flex-shrink-0">
                              <span className="text-2xl font-bold" style={{ color: TYPE_VALUE_COLOR[a.type] }}>{a.value}</span>
                              <p className="text-slate-500 text-[10px] font-bold uppercase mt-0.5">{a.valueLabel}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end mt-4 pt-4 border-t gap-2" style={{ borderColor: 'rgba(236,91,19,0.05)' }}>
                          <button
                            onClick={() => dismissAlert(a.id)}
                            className="px-4 py-2 rounded-lg text-slate-300 text-xs font-bold border hover:bg-orange-500/5 transition-all"
                            style={{ background: 'rgba(38,28,24,1)', borderColor: 'rgba(236,91,19,0.1)' }}
                          >
                            Ignorar
                          </button>
                          <button 
                            onClick={() => navigate('/app/reports')}
                            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all"
                          >
                            Ver Detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Empty state (after dismiss all) ── */}
          {!loading && visibleAlerts.length === 0 && alerts.length > 0 && (
            <div className="glass-card-alert rounded-2xl p-8 text-center" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-5xl mb-4 block text-green-400">check_circle</span>
              <h3 className="text-white font-bold mb-2">Nenhum alerta ativo</h3>
              <p className="text-slate-400 text-sm">Todos os alertas foram dispensados. Clique em "Gerar Alertas IA" para uma nova análise.</p>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
