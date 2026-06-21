import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeField } from '../services/api';
import type { FieldAnalysisResult } from '../services/api';
import FieldMap from '../components/FieldMap';
import useAppStore from '../store/useAppStore';
import type { Alert } from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';

// ── Market data ───────────────────────────────────────────────────────────────
interface MarketData {
  soja: { price: string; change: string; up: boolean };
}

async function fetchMarket(): Promise<MarketData> {
  try {
    const res = await fetch('https://api.hgbrasil.com/finance?format=json&key=demo');
    if (!res.ok) throw new Error('fetch error');
    const json = await res.json();
    // HG Brasil returns currencies/stocks — use USD/BRL as proxy for commodity index
    const usd = json?.results?.currencies?.USD;
    if (usd) {
      const price = `R$ ${Number(usd.buy).toFixed(2)}`;
      const pct = usd.variation ?? 0;
      return { soja: { price, change: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 } };
    }
    throw new Error('no data');
  } catch {
    return { soja: { price: 'Atualizando...', change: '—', up: true } };
  }
}

// ── Alert type colors ─────────────────────────────────────────────────────────
const ALERT_COLORS: Record<Alert['type'], { accent: string; text: string; border: string; bg: string }> = {
  critical: { accent: '#ec5b13', text: '#ec5b13', border: 'rgba(236,91,19,0.16)', bg: 'rgba(236,91,19,0.08)' },
  warning:  { accent: '#f59e0b', text: '#fbbf24', border: 'rgba(245,158,11,0.16)', bg: 'rgba(245,158,11,0.08)' },
  info:     { accent: '#60a5fa', text: '#60a5fa', border: 'rgba(96,165,250,0.16)', bg: 'rgba(96,165,250,0.08)' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { fields, weatherCache, alerts, activeFieldId, focusActiveField } = useAppStore();
  const [market, setMarket] = useState<MarketData>({
    soja: { price: 'Atualizando...', change: '—', up: true },
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FieldAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const activeField = activeFieldId
    ? fields.find((field) => field.id === activeFieldId) ?? null
    : null;
  const activeFieldArea = activeField?.areaHa
    ?? (activeField?.boundaries && activeField.boundaries.length >= 3 ? polygonAreaHa(activeField.boundaries) : null);

  useEffect(() => {
    // Evita exibir resultado de análise de um talhão antigo ao trocar seleção.
    setAnalysisResult(null);
    setAnalysisError(null);
  }, [activeFieldId]);

  const handleAnalyze = async () => {
    if (!activeField) return;
    const loc = activeField;
    
    setAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const fieldName = loc.name || 'Setor Base';
      const cropType = loc.cultura;
      const result = await analyzeField(
        loc.lat, 
        loc.lng, 
        fieldName, 
        cropType, 
        weatherCache,
        loc.boundaries || null,
        loc.dataPlantio,
        loc.variedade,
        loc.areaHa
      );
      
      setAnalysisResult(result);
      localStorage.setItem(`tracto-ndvi-${loc.lat}-${loc.lng}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
      
    } catch (e) {
      console.error(e);
      setAnalysisError(e instanceof Error ? e.message : 'Nao foi possivel concluir a analise.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch market once
  useEffect(() => {
    fetchMarket().then(setMarket);
  }, []);

  // ── Computed metrics ──────────────────────────────────────────────────────
  const totalAreaHa = fields.reduce((sum, loc) => {
    if (loc.boundaries && loc.boundaries.length >= 3) return sum + polygonAreaHa(loc.boundaries);
    return sum + 0.01;
  }, 0);

  const areaDisplay = fields.length === 0
    ? 'Sem dados'
    : totalAreaHa >= 1000
      ? `${(totalAreaHa / 1000).toFixed(2)}k`
      : totalAreaHa.toFixed(1);
  const areaUnit = fields.length === 0 ? '' : totalAreaHa >= 1000 ? 'k ha' : 'ha';

  const precipToday = weatherCache
    ? `${(weatherCache.daily.precipSum[0] ?? 0).toFixed(1)}`
    : '—';
  const precipUnit = weatherCache ? 'mm' : '';

  // Alerts: show top 2 non-dismissed, prioritizing critical
  const activeAlerts = alerts
    .filter((a) => !a.dismissed)
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.type] - order[b.type];
    })
    .slice(0, 2);

  const METRICS = [
    {
      label: 'Área Monitorada',
      value: areaDisplay,
      unit: areaUnit,
      trend: fields.length > 0 ? `${fields.length} talhão${fields.length > 1 ? 'ões' : ''}` : 'Sem talhões',
      up: true,
      color: '#4ade80',
    },
    {
      label: 'NDVI Médio',
      value: analysisResult ? analysisResult.ndvi_analysis.ndvi_medio.toFixed(2) : 'Sem análise',
      unit: '',
      trend: activeField
        ? (analysisResult ? 'Última análise do talhão ativo' : 'Disponível após primeira análise')
        : 'Selecione um talhão para analisar',
      up: analysisResult ? (analysisResult.ndvi_analysis.ndvi_medio > 0.5) : false,
      color: '#60a5fa',
    },
    {
      label: 'Precipitação',
      value: precipToday,
      unit: precipUnit,
      trend: weatherCache ? 'Hoje (Open-Meteo)' : 'Sem dados',
      up: (weatherCache?.daily.precipSum[0] ?? 0) > 0,
      color: '#60a5fa',
    },
    {
      label: 'Produtividade',
      value: 'Sem base',
      unit: '',
      trend: 'Sem histórico suficiente',
      up: false,
      color: '#64748b',
    },
  ];


  return (
    <>
      {/* Mapa Central */}
      <section className="flex-1 flex flex-col overflow-hidden p-4 gap-4 min-w-0">
        <div className="flex-1 relative rounded-xl overflow-hidden min-h-0 always-dark" style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0c0c0e' }}>
          <FieldMap />
          {/* Marca d'água — ícone Tracto no canto do mapa */}
          <div
            className="absolute bottom-5 left-5 z-[400] pointer-events-none select-none flex items-center gap-2"
            style={{ opacity: 0.55 }}
          >
            <img
              src="/tracto-icon.png" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/tracto-icon.svg"; }}
              alt=""
              className="tracto-brand-icon"
              style={{ width: 28, height: 28, objectFit: 'contain' }}
            />
            <span
              className="text-[11px] font-black tracking-[0.18em] text-white"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            >
              TRACTO
            </span>
          </div>
        </div>
      </section>

      {/* Sidebar de Inteligência — escondida em mobile (< 1024px) */}
      <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col overflow-y-auto scrollbar-thin" style={{ background: 'rgba(255,255,255,0.015)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="p-4 flex flex-col gap-4">

          {/* Cards de Métricas */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(236,91,19,0.08)', border: '1px solid rgba(236,91,19,0.2)' }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f97316' }}>Talhão ativo</p>
              <button
                onClick={() => focusActiveField()}
                disabled={!activeField}
                className="text-[10px] font-bold px-2 py-1 rounded"
                style={{ background: 'rgba(236,91,19,0.2)', color: '#f97316', opacity: activeField ? 1 : 0.5 }}
              >
                Focar no mapa
              </button>
            </div>
            <p className="text-sm font-bold text-white">{activeField?.name ?? 'Selecione um talhão no mapa'}</p>
            <p className="text-[11px]" style={{ color: '#cbd5e1' }}>
              {activeField
                ? `${activeFieldArea ? `${activeFieldArea.toFixed(2)} ha` : 'Área disponível após desenho'}${activeField.cultura ? ` · ${activeField.cultura}` : ' · Cultura não informada'}`
                : 'Análise disponível após selecionar um talhão'}
            </p>
            <p className="text-[10px]" style={{ color: '#94a3b8' }}>
              {activeField
                ? (activeField.dataPlantio ? `Plantio: ${new Date(activeField.dataPlantio).toLocaleDateString('pt-BR')}` : 'Plantio não informado')
                : 'Selecione na lista de talhões para começar'}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>
              Métricas da Fazenda
            </p>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map((m) => (
                <div key={m.label} className="p-3 rounded-xl flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>{m.label}</p>
                  <p className="text-lg font-bold text-white leading-tight">
                    {m.value}
                    <span className="text-xs font-normal ml-0.5" style={{ color: '#64748b' }}>{m.unit}</span>
                  </p>
                  <p className="text-[10px] font-semibold" style={{ color: m.up ? '#4ade80' : '#f87171' }}>{m.trend}</p>
                  <div className="h-1 w-full rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full w-3/4" style={{ background: m.color + '66' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status IA */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white">Tracto IA</p>
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#4ade80' }}>
                <span className="relative w-1.5 h-1.5 rounded-full bg-green-400">
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                </span>
                Ativo
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: '#94a3b8' }}>
              {fields.length > 0
                ? `Monitorando ${fields.length} talhão${fields.length > 1 ? 'ões' : ''} · Área: ${areaDisplay}${areaUnit}`
                : 'Aguardando talhões cadastrados para análise.'}
            </p>
          </div>

          {/* Análise Satélite */}
          {activeField ? (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
                  Análise do Talhão Ativo
                </p>
                {analysisResult && (
                  <div className="flex gap-1">
                    {analysisResult.is_mock && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-500/20 text-amber-400" title="Dados simulados devido a indisponibilidade do serviço de clima">
                        MOCK
                      </span>
                    )}
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${analysisResult.cached ? 'bg-slate-700 text-slate-300' : 'bg-green-500/20 text-green-400'}`}>
                      {analysisResult.cached ? 'CACHE 24H' : 'ATUALIZADO'}
                    </span>
                  </div>
                )}

              </div>

              {!analysisResult ? (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  style={{ 
                    background: analysisError ? '#ef4444' : '#ec5b13', 
                    color: '#fff',
                    opacity: analyzing ? 0.7 : 1
                  }}
                >
                  {analyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analisando...
                    </>
                  ) : analysisError ? (
                    'Tentar novamente'
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">satellite_alt</span>
                      Analisar Talhão
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  {analysisResult.ndvi_image_base64 ? (
                    <div className="relative">
                      <img 
                        src={`data:image/png;base64,${analysisResult.ndvi_image_base64}`} 
                        alt="NDVI" 
                        className="w-full h-auto rounded-lg object-cover"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-white border border-white/10 uppercase tracking-widest">
                        {analysisResult.source || 'Sentinel-2 L2A'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-lg flex items-center justify-center p-4 text-center" style={{ background: '#0f2617', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-[10px] text-green-200">Imagem indisponível — {analysisResult.source?.includes('Simulado') ? 'Simulação indisponível' : 'cobertura de nuvens alta'}. Tente novamente em breve.</p>
                    </div>
                  )}
                  
                  {/* Confidence Bar (Honest UX) */}
                  <div className="px-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Confiança da Análise</p>
                      <p className="text-[9px] font-bold text-white">{(analysisResult.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000" 
                        style={{ 
                          width: `${analysisResult.confidence * 100}%`,
                          background: analysisResult.confidence > 0.8 ? '#4ade80' : analysisResult.confidence > 0.5 ? '#fbbf24' : '#f87171'
                        }} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">NDVI Médio (Real)</p>
                      <p className="text-sm font-bold text-white">{analysisResult.ndvi_analysis.ndvi_medio.toFixed(2)}</p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Janela Pulveriz.</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.spray_window?.color === 'green' ? 'text-green-400' : analysisResult.engine_results?.spray_window?.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                        {analysisResult.engine_results?.spray_window?.label.toUpperCase() || 'Sem recomendação'}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Risco Geada</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.frost_risk?.color === 'red' ? 'text-red-400' : 'text-white'}`}>
                        {analysisResult.engine_results?.frost_risk?.label.toUpperCase() || 'Sem risco relevante'}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Estresse Hídrico</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.water_stress?.color === 'red' ? 'text-red-400' : 'text-white'}`}>
                        {analysisResult.engine_results?.water_stress?.label.toUpperCase() || 'Sem estresse relevante'}
                      </p>
                    </div>
                  </div>
                  
                  {analysisResult.date_acquired && (
                    <p className="text-[9px] text-slate-500 text-center flex items-center justify-center gap-1">
                      <span>Imagem de {new Date(analysisResult.date_acquired.split(' ')[0]).toLocaleDateString('pt-BR')}</span>
                      {analysisResult.date_acquired.includes('(Aproximado)') && <span className="text-amber-500/80 font-bold">(Aprox)</span>}
                    </p>
                  )}
                  
                  <button
                    onClick={() => navigate('/app/reports')}
                    className="w-full py-1.5 mt-1 rounded text-[10px] font-semibold transition-all hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}
                  >
                    Ver Relatório Completo
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
                Análise do Talhão Ativo
              </p>
              <div className="rounded-lg px-3 py-3" style={{ background: 'rgba(236,91,19,0.08)', border: '1px solid rgba(236,91,19,0.18)' }}>
                <p className="text-xs font-semibold text-white">Selecione um talhão</p>
                <p className="text-[11px] mt-1" style={{ color: '#cbd5e1' }}>A análise fica disponível após escolher o talhão ativo no mapa ou no seletor superior.</p>
              </div>
            </div>
          )}

          {/* Alertas Prioritários (do store) */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>
              Alertas Prioritários
            </p>
            <div className="space-y-2">
              {activeAlerts.length === 0 ? (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>
                    {alerts.length === 0
                      ? 'Vá em Alertas para gerar análise IA'
                      : 'Nenhum alerta ativo no momento'}
                  </p>
                </div>
              ) : (
                activeAlerts.map((alert) => {
                  const c = ALERT_COLORS[alert.type];
                  return (
                    <div key={alert.id} className="p-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: c.text }}>
                        {alert.type === 'critical' ? '⚠ Crítico' : alert.type === 'warning' ? '⚠ Aviso' : 'ℹ Info'}
                      </p>
                      <p className="text-xs font-semibold text-white truncate">{alert.title}</p>
                      <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#94a3b8' }}>{alert.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Mercado */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>Mercado</p>
            <div className="space-y-1.5">
              {[
                {
                  name: 'Câmbio USD/BRL',
                  detail: 'Referência cambial (HG Brasil)',
                  value: market.soja.price,
                  change: market.soja.change,
                  up: market.soja.up,
                },
                {
                  name: 'Índice Logístico',
                  detail: 'Região: Centro-Oeste',
                  value: '104.2',
                  change: '-0.4%',
                  up: false,
                },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.name}</p>
                    <p className="text-[10px]" style={{ color: '#64748b' }}>{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">{item.value}</p>
                    <p className="text-[10px] font-semibold" style={{ color: item.up ? '#4ade80' : '#f87171' }}>{item.change}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2 text-right pr-1" style={{ color: '#64748b' }}>Preço real da soja em breve</p>
          </div>

          <button
            onClick={() => navigate('/app/reports')}
            className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            Ver Relatório Completo
          </button>
        </div>
      </aside>
    </>
  );
}
