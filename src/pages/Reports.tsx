import { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import useAppStore from '../store/useAppStore';
import type { Location } from '../store/useAppStore';
import type { FieldAnalysisResult, FieldIntelligenceSnapshot } from '../services/api';
import { apiFetch } from '../services/api';
import { polygonAreaHa } from '../utils/geo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  crop_type?: string;
  planting_date?: string;
  harvest_date?: string;
  area_ha?: number;
  productivity_sc_ha?: number;
  productivity_kg_ha?: number;
}

interface AnalysisHistoryEntry {
  date: string;          // ISO date string
  ndvi_medio: number;
  zona_saudavel_pct: number;
  zona_critica_pct: number;
  cloud_coverage: number | null;
  is_mock: boolean;
}

// Shape returned by /api/fields/{id}/analyses — adapt if backend differs
interface ApiAnalysisEntry {
  date?: string;
  analyzed_at?: string;
  ndvi_medio?: number;
  ndvi_avg?: number;
  zona_saudavel_pct?: number;
  zona_critica_pct?: number;
  cloud_coverage?: number | null;
  is_mock?: boolean;
}

// ── Tooltip pt-BR para recharts ───────────────────────────────────────────────

interface TooltipPayloadEntry {
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function NdviTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0].value;
  const dateStr = label
    ? new Date(label).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(236,91,19,0.3)', color: '#f1f5f9' }}
    >
      <p className="font-semibold mb-0.5" style={{ color: '#ec5b13' }}>{dateStr}</p>
      <p>NDVI Médio: <span className="font-bold text-white">{value.toFixed(3)}</span></p>
    </div>
  );
}

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

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(
  fields: ReturnType<typeof useAppStore.getState>['fields'],
  intelligenceById: ReturnType<typeof useAppStore.getState>['fieldIntelligenceById']
) {
  const cols = [
    'campo',
    'area_ha',
    'lat',
    'lng',
    'ndvi_medio',
    'zona_saudavel_pct',
    'zona_critica_pct',
    'cloud_coverage',
    'data_analise',
    'is_mock',
  ];

  const rows: string[][] = fields.map((f) => {
    const area = f.boundaries ? polygonAreaHa(f.boundaries) : 0;
    const snap: FieldIntelligenceSnapshot | undefined = f.id ? intelligenceById[f.id] : undefined;

    const satellite = (snap?.satellite ?? {}) as Record<string, unknown>;
    const ndviStats = (satellite.ndvi_stats ?? {}) as Record<string, unknown>;
    const analysis = (snap?.analysis ?? {}) as Record<string, unknown>;

    const ndviMedio = snap ? Number(ndviStats.ndvi_avg ?? 0) : 0;
    const cloudCoverage = snap ? String(satellite.cloud_coverage ?? '') : '';
    const dataAnalise = snap ? snap.updated_at : '';
    const isMock = snap ? String(snap.weather_status.status !== 'ok') : '';

    // zona_saudavel_pct / zona_critica_pct são derivados do engine; fallback 0 se não disponível
    const sprayLevel = ((analysis.spray_window as Record<string, unknown> | undefined)?.level as number | undefined) ?? 0;
    const zonaSaudavel = snap ? Math.max(0, Math.round(sprayLevel * 20)).toString() : '';
    const zonaCritica = snap ? Math.max(0, Math.round((5 - sprayLevel) * 5)).toString() : '';

    return [
      f.name ?? `Talhão`,
      area.toFixed(2),
      f.lat.toFixed(6),
      f.lng.toFixed(6),
      ndviMedio.toFixed(3),
      zonaSaudavel,
      zonaCritica,
      cloudCoverage,
      dataAnalise,
      isMock,
    ];
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csvContent = [
    cols.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tracto-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const { fields, activeFieldId, fetchFieldIntelligence, fieldIntelligenceById } = useAppStore();
  const [analysisResults, setAnalysisResults] = useState<Record<string, FieldAnalysisResult>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});
  const [autoRunning, setAutoRunning] = useState(false);

  // ── Histórico de análises ──
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<AnalysisHistoryEntry[]>([]);

  // ── Safras ──
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);

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
      }, i * 1200);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // ── Buscar histórico quando activeFieldId mudar ──────────────────────────────
  useEffect(() => {
    if (!activeFieldId) {
      setHistoryData([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryData([]);

    apiFetch<ApiAnalysisEntry[]>(`/api/fields/${activeFieldId}/analyses`)
      .then((entries) => {
        const parsed: AnalysisHistoryEntry[] = entries
          .filter((e) => (e.date ?? e.analyzed_at) && (e.ndvi_medio ?? e.ndvi_avg) !== undefined)
          .map((e) => ({
            date: e.date ?? e.analyzed_at ?? '',
            ndvi_medio: Number(e.ndvi_medio ?? e.ndvi_avg ?? 0),
            zona_saudavel_pct: Number(e.zona_saudavel_pct ?? 0),
            zona_critica_pct: Number(e.zona_critica_pct ?? 0),
            cloud_coverage: e.cloud_coverage ?? null,
            is_mock: Boolean(e.is_mock ?? false),
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setHistoryData(parsed);
      })
      .catch(() => {
        // Silenciar: campo pode não ter histórico ainda
        setHistoryData([]);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [activeFieldId]);

  // ── Buscar safras quando activeFieldId mudar ─────────────────────────────────
  useEffect(() => {
    if (!activeFieldId) { setSeasons([]); return; }
    setSeasonsLoading(true);
    apiFetch<Season[]>(`/api/fields/${activeFieldId}/seasons`)
      .then(setSeasons)
      .catch(() => setSeasons([]))
      .finally(() => setSeasonsLoading(false));
  }, [activeFieldId]);

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
        <div className="flex items-center justify-between flex-wrap gap-3">
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
          <div className="flex items-center gap-2">
            {/* Exportar CSV */}
            <button
              onClick={() => exportCSV(fields, fieldIntelligenceById)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
            >
              <span className="material-symbols-outlined text-sm">table_view</span>
              Exportar CSV
            </button>
            {/* Exportar PDF */}
            <button
              onClick={() => exportPDF(fields, activeField?.name ?? null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.28)' }}
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              Exportar PDF
            </button>
          </div>
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

        {/* ── HISTÓRICO DE ANÁLISES ─────────────────────────────────────────── */}
        {hasFields && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>timeline</span>
                Histórico de Análises
              </h2>
              {activeField && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
                  {activeField.name ?? 'Talhão'}
                </span>
              )}
            </div>

            <div className="p-5">
              {historyLoading ? (
                <div className="flex flex-col gap-3 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/3" />
                  <div className="h-40 bg-white/05 rounded-xl" />
                </div>
              ) : historyData.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="material-symbols-outlined text-3xl block mb-2 opacity-40" style={{ color: '#64748b' }}>show_chart</span>
                  <p className="text-sm font-semibold text-white mb-1">Sem histórico disponível</p>
                  <p className="text-xs max-w-sm mx-auto" style={{ color: '#64748b' }}>
                    Execute análises para ver a evolução do NDVI ao longo do tempo.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Gráfico de linha NDVI */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Evolução do NDVI</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={historyData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v: string) =>
                            new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                          }
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 1]}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          tickCount={5}
                        />
                        <Tooltip content={<NdviTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="ndvi_medio"
                          stroke="#ec5b13"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#ec5b13', strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: '#ec5b13' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Cards de linha do tempo */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Registros</p>
                    <div className="flex flex-col gap-2">
                      {historyData.slice().reverse().map((entry, idx) => (
                        <div
                          key={`${entry.date}-${idx}`}
                          className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: '#ec5b13' }}
                            />
                            <div>
                              <p className="text-xs font-semibold text-white">
                                {new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </p>
                              {entry.cloud_coverage !== null && (
                                <p className="text-[10px]" style={{ color: '#64748b' }}>
                                  Nuvens: {entry.cloud_coverage}%
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-[10px]" style={{ color: '#64748b' }}>NDVI</p>
                              <p className="text-sm font-bold text-white">{entry.ndvi_medio.toFixed(3)}</p>
                            </div>
                            {entry.zona_saudavel_pct > 0 && (
                              <div>
                                <p className="text-[10px]" style={{ color: '#64748b' }}>Saudável</p>
                                <p className="text-sm font-bold text-green-400">{entry.zona_saudavel_pct}%</p>
                              </div>
                            )}
                            {entry.zona_critica_pct > 0 && (
                              <div>
                                <p className="text-[10px]" style={{ color: '#64748b' }}>Crítico</p>
                                <p className="text-sm font-bold text-red-400">{entry.zona_critica_pct}%</p>
                              </div>
                            )}
                            {entry.is_mock && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
                              >
                                mock
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
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

        {/* ── Comparativo de Safras ── */}
        {activeFieldId && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined" style={{ color: '#ec5b13' }}>grass</span>
              <h2 className="text-lg font-black text-white">Comparativo de Safras</h2>
            </div>

            {seasonsLoading && (
              <div className="flex items-center gap-2 py-4" style={{ color: '#64748b' }}>
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#ec5b13', borderTopColor: 'transparent' }} />
                <span className="text-sm">Carregando safras...</span>
              </div>
            )}

            {!seasonsLoading && seasons.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 opacity-50">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#64748b' }}>agriculture</span>
                <p className="text-sm" style={{ color: '#64748b' }}>Nenhuma safra cadastrada — acesse Safras &amp; Produtividade para adicionar.</p>
              </div>
            )}

            {!seasonsLoading && seasons.length > 0 && (
              <>
                {/* Tabela */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Safra', 'Cultura', 'Plantio', 'Colheita', 'Área (ha)', 'sc/ha', 'Total (sc)'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {seasons.map(s => {
                        const total = s.productivity_sc_ha != null && s.area_ha != null
                          ? (s.productivity_sc_ha * s.area_ha).toFixed(0) : '—';
                        const fmtDate = (d?: string) => d ? d.split('-').reverse().join('/') : '—';
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td className="px-3 py-2 font-bold text-white">{s.name}</td>
                            <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{s.crop_type ?? '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{fmtDate(s.planting_date)}</td>
                            <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{fmtDate(s.harvest_date)}</td>
                            <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{s.area_ha ?? '—'}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: '#22c55e' }}>{s.productivity_sc_ha ?? '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{total}</td>
                          </tr>
                        );
                      })}
                      {/* Média */}
                      {seasons.filter(s => s.productivity_sc_ha != null).length > 0 && (
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <td colSpan={5} className="px-3 py-2 text-xs font-bold uppercase" style={{ color: '#64748b' }}>Média</td>
                          <td className="px-3 py-2 font-black" style={{ color: '#f59e0b' }}>
                            {(seasons.filter(s => s.productivity_sc_ha != null)
                              .reduce((a, s) => a + (s.productivity_sc_ha ?? 0), 0) /
                              seasons.filter(s => s.productivity_sc_ha != null).length).toFixed(1)}
                          </td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Gráfico de barras */}
                {seasons.filter(s => s.productivity_sc_ha != null).length >= 2 && (() => {
                  const chartData = [...seasons].filter(s => s.productivity_sc_ha != null)
                    .reverse()
                    .map(s => ({ name: s.name, value: s.productivity_sc_ha as number }));
                  const avg = chartData.reduce((a, d) => a + d.value, 0) / chartData.length;
                  const maxVal = Math.max(...chartData.map(d => d.value));
                  return (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--surface,#1e293b)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v) => [`${Number(v).toFixed(1)} sc/ha`, 'Produtividade']}
                        />
                        <ReferenceLine y={avg} stroke="#f59e0b" strokeDasharray="4 4" />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.value === maxVal ? '#22c55e' : '#ec5b13'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </>
            )}
          </div>
        )}

      </div>
      )}
    </div>
  );
}
