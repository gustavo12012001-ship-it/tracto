import { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import useAppStore from '../store/useAppStore';
import type { Location } from '../store/useAppStore';
import type { FieldAnalysisResult, FieldIntelligenceSnapshot } from '../services/api';
import { polygonAreaHa } from '../utils/geo';

// ── Sem dados históricos simulados na Etapa 2 ───────────────────────────────


// ── PDF export ────────────────────────────────────────────────────────────────
function exportPDF(
  fields: ReturnType<typeof useAppStore.getState>['fields'],
  activeFieldName?: string | null
) {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(236, 91, 19);
  doc.text('Tracto — Relatório de Talhões', 15, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 28);

  if (activeFieldName) {
    doc.setTextColor(236, 91, 19);
    doc.text(`Talhão ativo em destaque: ${activeFieldName}`, 15, 34);
  }

  let y = activeFieldName ? 44 : 40;
  fields.forEach((f, i) => {
    const area = f.boundaries ? polygonAreaHa(f.boundaries) : 0;
    const name = f.name ?? `Talhão ${i + 1}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${i + 1}. ${name}`, 15, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Área: ${area.toFixed(2)} ha`, 20, y);
    y += 5;
    doc.text(`Coordenadas: lat ${f.lat.toFixed(5)}, lng ${f.lng.toFixed(5)}`, 20, y);
    y += 5;
    doc.text(`Vértices: ${f.boundaries?.length ?? 0}`, 20, y);
    y += 10;

    if (y > 270) { doc.addPage(); y = 20; }
  });

  if (fields.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum talhão cadastrado.', 15, y);
  }

  doc.save('tracto-relatorio.pdf');
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const { fields, activeFieldId, fetchFieldIntelligence } = useAppStore();
  const [analysisResults, setAnalysisResults] = useState<Record<string, FieldAnalysisResult>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});
  const [autoRunning, setAutoRunning] = useState(false);

  const snapshotToFieldAnalysisResult = (snapshot: FieldIntelligenceSnapshot): FieldAnalysisResult => {
    const satellite = (snapshot.satellite ?? {}) as Record<string, unknown>;
    const analysis = (snapshot.analysis ?? {}) as Record<string, unknown>;
    const ndviStats = (satellite.ndvi_stats ?? {}) as Record<string, unknown>;

    return {
      field_name: snapshot.field_name,
      ndvi_image_base64: (satellite.ndvi_image_base64 as string | null) ?? null,
      date_acquired: (satellite.scene_date_br as string | null) ?? null,
      cloud_coverage: (satellite.cloud_coverage as number | null) ?? null,
      ndvi_analysis: {
        ndvi_medio: Number(ndviStats.ndvi_avg ?? 0),
        zona_critica_pct: 0,
        zona_estresse_pct: 0,
        zona_saudavel_pct: 0,
        zona_excelente_pct: 0,
        solo_exposto_pct: 0,
        problemas_detectados: [],
        areas_atencao: 'Consulte a cena satelital para inspeção visual detalhada.',
        tendencia: 'estavel',
        confianca: Number(analysis.confidence ?? 0),
        janela_pulverizacao: ((analysis.spray_window as Record<string, unknown> | undefined)?.label as string | undefined) ?? 'N/D',
        risco_geada: ((analysis.frost_risk as Record<string, unknown> | undefined)?.label as string | undefined) ?? 'N/D',
        deficit_hidrico: ((analysis.water_stress as Record<string, unknown> | undefined)?.label as string | undefined) ?? 'N/D',
        recomendacao_irrigacao: 'Use o diagnóstico consolidado e valide no campo.',
      },
      weather_summary: String((snapshot.weather as Record<string, unknown>)?.condition ?? 'N/D'),
      ai_report: snapshot.report_summary,
      alerts: snapshot.alerts,
      cached: false,
      is_mock: snapshot.weather_status.status !== 'ok',
      analyzed_at: snapshot.updated_at,
      confidence: Number(analysis.confidence ?? 0),
      engine_results: {
        spray_window: (analysis.spray_window as { color: string; label: string; level: number }) ?? { color: 'gray', label: 'N/D', level: 0 },
        frost_risk: (analysis.frost_risk as { color: string; label: string; level: number }) ?? { color: 'gray', label: 'N/D', level: 0 },
        water_stress: (analysis.water_stress as { color: string; label: string; level: number }) ?? { color: 'gray', label: 'N/D', level: 0 },
      },
      source: String(satellite.provider ?? 'Snapshot do talhão'),
    };
  };

  // Carregar do cache inicial se existir
  useEffect(() => {
    const initial: Record<string, FieldAnalysisResult> = {};
    fields.forEach(loc => {
      const key = `${loc.lat}-${loc.lng}`;
      const cached = localStorage.getItem(`tracto-ndvi-${key}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            initial[key] = parsed.data;
          }
        } catch {
          // Ignora cache inválido e segue com estado inicial vazio.
        }
      }
    });
    setAnalysisResults(initial);
  }, [fields]);

  // VALIDAÇÃO RIGOROSA: activeFieldId DEVE estar em fields[]
  const activeField = activeFieldId ? fields.find((field) => field.id === activeFieldId) : null;

  const handleAnalyze = useCallback(async (loc: Location, forceRefresh = false) => {
    const key = loc.id ?? `${loc.lat}-${loc.lng}`;
    setLoadingAnalysis(prev => ({ ...prev, [key]: true }));
    try {
      if (!loc.id) {
        throw new Error('Talhão sem identificador válido para snapshot.');
      }

      const snapshot = await fetchFieldIntelligence(loc.id, forceRefresh);
      if (!snapshot) {
        throw new Error('Snapshot indisponível para o talhão selecionado.');
      }

      const result = snapshotToFieldAnalysisResult(snapshot);

      setAnalysisResults(prev => ({ ...prev, [key]: result }));
      localStorage.setItem(`tracto-ndvi-${key}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [key]: false }));
    }
  }, [fetchFieldIntelligence]);

  // Auto-analyze active field immediately on selection
  useEffect(() => {
    if (!activeFieldId) return;
    const selected = fields.find((item) => item.id === activeFieldId);
    if (selected) {
      void handleAnalyze(selected, false);
    }
  }, [activeFieldId, fields, handleAnalyze]);

  // Auto-analyze ALL fields silently on mount (background, uses cache first)
  useEffect(() => {
    if (fields.length === 0) return;
    setAutoRunning(true);
    let completed = 0;
    const total = fields.filter(f => f.id).length;
    // Stagger requests to avoid hammering the API
    fields.forEach((loc, i) => {
      if (!loc.id) return;
      const key = loc.id;
      setTimeout(() => {
        setAnalysisResults(prev => {
          if (!prev[key]) {
            void handleAnalyze(loc, false).finally(() => {
              completed++;
              if (completed >= total) setAutoRunning(false);
            });
          } else {
            completed++;
            if (completed >= total) setAutoRunning(false);
          }
          return prev;
        });
      }, i * 1200); // 1.2s stagger between requests
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const hasFields = fields.length > 0;


  const totalArea = fields.reduce((s, l) =>
    s + (l.boundaries ? polygonAreaHa(l.boundaries) : 0.01), 0);

  const kpis = [
    { label: 'Prod. Média', value: 'N/D', icon: 'agriculture', color: '#4ade80' },
    { label: 'NDVI Médio', value: 'N/D', icon: 'satellite_alt', color: '#60a5fa' },
    { label: 'Relatórios', value: String(hasFields ? fields.length : 0), icon: 'description', color: '#ec5b13' },
    { label: 'Área Analisada', value: hasFields ? `${totalArea.toFixed(1)} ha` : '–', icon: 'map', color: '#a78bfa' },
  ];

  const fieldRows = hasFields
    ? fields.map((loc, i) => ({
        icon: 'description',
        name: `Relatório — ${loc.name ?? `Talhão ${i + 1}`}`,
        date: 'Sob demanda',
        field: loc.name ?? `Talhão ${i + 1}`,
        area: loc.boundaries ? `${polygonAreaHa(loc.boundaries).toFixed(2)} ha` : '< 0.01 ha',
        status: 'Disponível',
      }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg)' }}>
      {/* VALIDAÇÃO: Nenhum talhão selecionado */}
      {!activeFieldId || !fields.some((f) => f.id === activeFieldId) ? (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Nenhum talhão selecionado</h2>
            <p className="text-gray-600 mb-6">Selecione um talhão ativo no mapa para visualizar a análise de relatórios.</p>
          </div>
        </div>
      ) : (
      <div className="p-5 flex flex-col gap-5 max-w-5xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Relatórios</h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {hasFields ? `${fields.length} talhão${fields.length > 1 ? 'ões' : ''} · Relatórios Determinísticos` : 'Cadastre talhões para gerar relatórios'}
            </p>
            {activeField && (
              <p className="text-xs mt-1" style={{ color: '#ec5b13' }}>
                Talhão em análise: {activeField.name ?? 'Talhão sem nome'}
              </p>
            )}
          </div>
          <button
            onClick={() => exportPDF(fields, activeField?.name ?? null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.28)' }}
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>

        {/* ── Auto-análise banner ── */}
        {autoRunning ? (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(236,91,19,0.08)', border: '1px solid rgba(236,91,19,0.2)' }}>
            <span className="material-symbols-outlined shrink-0 animate-spin text-lg" style={{ color: '#ec5b13' }}>progress_activity</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#ec5b13' }}>
                Análise automática em andamento...
              </p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                Coletando imagens de satélite Sentinel-2, dados meteorológicos e gerando relatório com IA para todos os talhões.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <span className="material-symbols-outlined shrink-0" style={{ color: '#4ade80' }}>smart_toy</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>
                Análise automática concluída
              </p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                IA analisou Sentinel-2 + meteorologia de todos os talhões · Última verificação: {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.color + '18' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: k.color }}>{k.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{k.label}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-base font-bold text-white">{k.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Análise de Satélite ── */}
        {hasFields && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">satellite_alt</span>
              Análise de Satélite
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {fields.map((loc, i) => {
                const key = loc.id ?? `${loc.lat}-${loc.lng}`;
                const result = analysisResults[key];
                const isLoading = loadingAnalysis[key];
                const name = loc.name ?? `Talhão ${i + 1}`;

                return (
                  <div key={key} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {isLoading ? (
                      <div className="p-6 col-span-1 animate-pulse flex flex-col gap-4">
                        <div className="h-4 bg-white/10 rounded w-1/4"></div>
                        <div className="h-48 bg-white/5 rounded-xl w-full"></div>
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      </div>
                    ) : result ? (
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white">{name}</h3>
                          {result.date_acquired && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                              <span>{new Date(result.date_acquired?.split(' ')[0] || '').toLocaleDateString('pt-BR')}</span>
                              {result.date_acquired.includes('(Aproximado)') && <span className="text-amber-500/80">(Aprox)</span>}
                              {result.cloud_coverage !== null && ` · Nuvens: ${result.cloud_coverage}%`}
                            </span>
                          )}
                        </div>

                        {result.ndvi_image_base64 && (
                          <img 
                            src={`data:image/png;base64,${result.ndvi_image_base64}`} 
                            alt={`NDVI ${name}`}
                            className="w-full h-[200px] object-cover rounded-xl mb-6"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        )}

                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metricas Deterministicas</h4>
                             <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${result.confidence > 0.7 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    Confianca: {(result.confidence * 100).toFixed(0)}%
                                </span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-700 text-slate-300">
                                    {result.source || 'Sentinel-2'}
                                </span>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">NDVI Médio</p>
                                <p className="text-sm font-bold text-white">{result.ndvi_analysis.ndvi_medio.toFixed(3)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Pulverização</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.spray_window?.color === 'green' ? 'text-green-400' : 'text-amber-400'}`}>
                                    {result.engine_results?.spray_window?.label.toUpperCase()}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Risco Geada</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.frost_risk?.level > 2 ? 'text-red-400' : 'text-white'}`}>
                                    {result.engine_results?.frost_risk?.label.toUpperCase()}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Estresse Hídrico</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.water_stress?.level > 2 ? 'text-red-400' : 'text-white'}`}>
                                    {result.engine_results?.water_stress?.label.toUpperCase()}
                                </p>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Zonas de Vigor (NDVI)</h4>
                          <div className="h-6 w-full rounded-full overflow-hidden flex" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="h-full bg-red-500" style={{ width: `${result.ndvi_analysis.zona_critica_pct}%` }} title={`Crítica: ${result.ndvi_analysis.zona_critica_pct}%`} />
                            <div className="h-full bg-yellow-500" style={{ width: `${result.ndvi_analysis.zona_estresse_pct}%` }} title={`Estresse: ${result.ndvi_analysis.zona_estresse_pct}%`} />
                            <div className="h-full bg-green-400" style={{ width: `${result.ndvi_analysis.zona_saudavel_pct}%` }} title={`Saudável: ${result.ndvi_analysis.zona_saudavel_pct}%`} />
                            <div className="h-full bg-green-700" style={{ width: `${result.ndvi_analysis.zona_excelente_pct}%` }} title={`Excelente: ${result.ndvi_analysis.zona_excelente_pct}%`} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                            <span>Crítico ({result.ndvi_analysis.zona_critica_pct}%)</span>
                            <span>Excelente ({result.ndvi_analysis.zona_excelente_pct}%)</span>
                          </div>
                        </div>

                        <div className="mb-6 prose prose-sm prose-invert max-w-none text-slate-300">
                          <p>{result.ai_report}</p>
                        </div>

                        {result.ndvi_analysis.problemas_detectados.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Problemas Detectados</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.ndvi_analysis.problemas_detectados.map(prob => (
                                <span key={prob} className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                                  {prob}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => handleAnalyze(loc, true)}
                                className="px-4 py-2 rounded-lg text-xs font-bold transition-all border text-slate-300 hover:text-white hover:bg-white/5"
                                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'transparent' }}
                            >
                                Re-analisar
                            </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col items-center justify-center text-center py-12">
                        <span className="material-symbols-outlined text-4xl mb-3" style={{ color: '#64748b' }}>query_stats</span>
                        <h3 className="text-white font-bold mb-1">{name}</h3>
                        <p className="text-xs text-slate-400 mb-4 max-w-sm">Gere um relatório detalhado de IA com imagens NDVI recentes de satélite e recomendações agronômicas.</p>
                        <button
                          onClick={() => handleAnalyze(loc, true)}
                          className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg"
                          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.3)' }}
                        >
                          Gerar Análise Completa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Honest UX: Histórico Real Missing ── */}
        {hasFields && (
          <div className="py-10 text-center rounded-2xl mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <span className="material-symbols-outlined text-4xl block mb-3 opacity-50" style={{ color: '#64748b' }}>timeline</span>
            <p className="text-sm font-semibold text-white mb-1">Histórico Temporal Indisponível</p>
            <p className="text-xs max-w-sm mx-auto" style={{ color: '#64748b' }}>
              São necessários múltiplos meses de coleta de imagens de satélite e dados de campo para gerar curvas de evolução do NDVI e Produtividade (Etapa 2).
            </p>
          </div>
        )}

        {/* ── Reports Table ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white">Relatórios Disponíveis</h2>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
              {fieldRows.length} registros
            </span>
          </div>

          {fieldRows.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#ec5b13' }}>description</span>
              <p className="text-sm font-semibold text-white mb-1">Nenhum talhão cadastrado</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Vá ao mapa e desenhe um talhão para gerar relatórios automáticos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Relatório', 'Talhão', 'Área', 'Data', 'Status', ''].map((h) => (
                      <th key={h} className="px-5 py-3 text-left font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fieldRows.map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                            <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>{row.icon}</span>
                          </div>
                          <span className="font-medium text-white truncate max-w-[140px]">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.field}</td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.area}</td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.date}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => exportPDF([fields[i]], activeField?.name ?? null)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                          style={{ background: 'rgba(236,91,19,0.1)', color: '#ec5b13', border: '1px solid rgba(236,91,19,0.15)' }}
                        >
                          <span className="material-symbols-outlined text-xs">download</span>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Fonte canônica */}
        <div className="p-4 rounded-xl flex items-center gap-3 text-xs" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
          <span className="material-symbols-outlined text-blue-400">dataset</span>
          <span style={{ color: '#94a3b8' }}>Fonte principal: snapshot canônico do talhão ativo ({activeFieldId ? 'ativo' : 'selecione um talhão no mapa'}).</span>
        </div>

      </div>
      )}
    </div>
  );
}
