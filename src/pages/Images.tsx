// src/pages/Images.tsx — Imagens de Satélite por Talhão
// Layout: sidebar de talhões + dois mapas lado a lado (NDVI e Satélite) com navegação por data

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { API_URL, buildAuthHeaders } from '../services/api';
import ClippedImageOverlay from '../components/ClippedImageOverlay';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface SatArtifact {
  id: string;
  source: string;
  mode: string;
  scene_id: string | null;
  scene_date: string | null;
  cloud_coverage: number | null;
  generated_at: string;
  provider: string | null;
  bytes_size: number | null;
  image_path: string | null;
}

// ── Config visual ─────────────────────────────────────────────────────────────
const MODE_LABEL: Record<string, string> = {
  truecolor: 'RGB', ndvi: 'NDVI', ndre: 'NDRE',
  evi: 'EVI', ndmi: 'Umidade', sar: 'SAR',
  falsecolor: 'Falsa Cor', agriculture: 'Agro',
};

const MODE_COLOR: Record<string, string> = {
  ndvi: '#22c55e', ndre: '#a855f7', evi: '#10b981',
  ndmi: '#06b6d4', truecolor: '#60a5fa', sar: '#a78bfa',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return '—';
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: '2-digit',
    });
  } catch { return s.slice(0, 10); }
}

function computeBounds(b: [number, number][]): L.LatLngBoundsExpression {
  const lats = b.map(p => p[0]);
  const lngs = b.map(p => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

// ── FitBounds: encaixa o mapa nos limites do talhão (uma vez) ─────────────────
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!bounds || fittedRef.current) return;
    fittedRef.current = true;
    map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [20, 20] });
  }, [bounds, map]);
  return null;
}

// ── Hook: estado de um slot de artefato (NDVI ou Satélite) ───────────────────
function useArtifactSlot(artifacts: SatArtifact[]) {
  const [idx, setIdx] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevRef = useRef<string | null>(null);

  // chave estável para comparar a lista
  const listKey = artifacts.map(a => a.id).join(',');

  useEffect(() => {
    setIdx(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const safeIdx = Math.min(idx, Math.max(0, artifacts.length - 1));
  const active = artifacts[safeIdx] ?? null;

  useEffect(() => {
    if (!active) { setUrl(null); setError(null); return; }
    let cancelled = false;
    setLoading(true); setError(null);

    buildAuthHeaders()
      .then(h => fetch(`${API_URL}/api/satellite-artifacts/${active.id}/image`, { headers: h }))
      .then(async r => {
        if (cancelled) return;
        if (!r.ok) throw new Error(`Erro ${r.status}`);
        const blob = await r.blob();
        if (cancelled) return;
        if (prevRef.current) URL.revokeObjectURL(prevRef.current);
        const u = URL.createObjectURL(blob);
        prevRef.current = u;
        setUrl(u);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (prevRef.current) URL.revokeObjectURL(prevRef.current);
  }, []);

  return {
    idx: safeIdx,
    setIdx,
    url,
    loading,
    error,
    active,
    total: artifacts.length,
  };
}

// ── MapCard: painel de mapa com imagem recortada ──────────────────────────────
interface MapCardProps {
  mapKey: string;
  label: string;
  artifacts: SatArtifact[];
  slot: ReturnType<typeof useArtifactSlot>;
  fieldBoundaries: [number, number][];
  center: [number, number];
  mapBounds: L.LatLngBoundsExpression | null;
  onExpand?: () => void;
  onAnalyze?: () => void;
}

function MapCard({
  mapKey, label, artifacts: _artifacts, slot,
  fieldBoundaries, center, mapBounds,
  onExpand, onAnalyze,
}: MapCardProps) {
  const { idx, setIdx, url, loading, error, active, total } = slot;
  const modeColor = active ? (MODE_COLOR[active.mode] ?? '#94a3b8') : '#94a3b8';
  const modeLabel = active ? (MODE_LABEL[active.mode] ?? active.mode.toUpperCase()) : label;
  const dateLabel = active ? fmtDate(active.scene_date ?? active.generated_at) : '—';
  const sourceLabel = active?.source ? (active.source === 's2' ? 'Sentinel-2' : active.source === 's1' ? 'Sentinel-1' : active.source.toUpperCase()) : '';

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden flex-1 min-w-0 min-h-0"
      style={{ border: '1px solid var(--border)', background: '#080809' }}>

      {/* Header do card */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2"
        style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>

        <span className="text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: modeColor + '22', color: modeColor }}>
          {modeLabel}
        </span>

        <span className="text-[11px] font-bold text-white truncate flex-1">
          {total > 0 ? dateLabel : label}
        </span>

        {sourceLabel && (
          <span className="text-[9px] flex-shrink-0 hidden sm:inline" style={{ color: '#64748b' }}>
            {sourceLabel}
          </span>
        )}

        {loading && (
          <div className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin flex-shrink-0" />
        )}

        {active?.cloud_coverage != null && (
          <span className="text-[9px] flex-shrink-0" style={{ color: '#64748b' }}>
            ☁ {active.cloud_coverage.toFixed(0)}%
          </span>
        )}

        {/* Navegação */}
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx <= 0 || total === 0}
            title="Imagem anterior"
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/10">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--muted)' }}>chevron_left</span>
          </button>
          <span className="text-[9px] tabular-nums w-8 text-center" style={{ color: '#475569' }}>
            {total > 0 ? `${idx + 1}/${total}` : '—'}
          </span>
          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            disabled={idx >= total - 1 || total === 0}
            title="Próxima imagem"
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/10">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--muted)' }}>chevron_right</span>
          </button>
        </div>

        {/* Ações: expandir + IA */}
        {url && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-1 pl-1 border-l" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={onAnalyze}
              title="Analisar com Tracto IA"
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ color: 'var(--primary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
            </button>
            <button
              onClick={onExpand}
              title="Expandir"
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ color: 'var(--muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fullscreen</span>
            </button>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {total === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: '#080809' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: '#1e293b' }}>satellite_alt</span>
            <p className="text-[11px]" style={{ color: '#334155' }}>Sem imagens {label}</p>
          </div>
        ) : (
          <MapContainer
            key={mapKey}
            center={center}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}>
            <TileLayer
              url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              subdomains={['0', '1', '2', '3']}
              maxZoom={21}
              maxNativeZoom={20}
            />
            <FitBounds bounds={mapBounds} />
            {fieldBoundaries.length > 0 && (
              <Polygon
                positions={fieldBoundaries}
                pathOptions={{
                  color: url ? 'rgba(255,255,255,0.55)' : '#ec5b13',
                  fill: !url,
                  fillColor: '#ec5b13',
                  fillOpacity: url ? 0 : 0.07,
                  weight: 1.5,
                  dashArray: url ? undefined : '5 4',
                }}
              />
            )}
            {url && mapBounds && fieldBoundaries.length >= 3 && (
              <ClippedImageOverlay
                url={url}
                bounds={mapBounds}
                fieldBoundaries={fieldBoundaries}
              />
            )}
          </MapContainer>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-[10px] text-white">Carregando…</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && !loading && (
          <div className="absolute bottom-2 left-2 right-2 z-[500] flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span className="material-symbols-outlined text-xs" style={{ color: '#f87171' }}>error</span>
            <p className="text-[10px]" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Images() {
  const { fields, farms, activeFieldId, setActiveField } = useAppStore();

  const [selectedFieldId, setSelectedFieldId] = useState<string>(
    activeFieldId ?? fields[0]?.id ?? ''
  );
  const [artifacts, setArtifacts] = useState<SatArtifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;
  const fieldBoundaries = useMemo(
    () => (selectedField?.boundaries ?? []) as [number, number][],
    [selectedField?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const center: [number, number] = selectedField
    ? [selectedField.lat, selectedField.lng]
    : [-15.78, -47.93];
  const mapBounds = useMemo(
    () => fieldBoundaries.length >= 3 ? computeBounds(fieldBoundaries) : null,
    [fieldBoundaries]
  );

  // Sync com talhão ativo do store
  useEffect(() => {
    if (activeFieldId && activeFieldId !== selectedFieldId) {
      setSelectedFieldId(activeFieldId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

  const loadArtifacts = useCallback(async (fieldId: string) => {
    if (!fieldId) return;
    setLoadingArtifacts(true);
    setArtifacts([]);
    try {
      const headers = await buildAuthHeaders();
      const r = await fetch(
        `${API_URL}/api/fields/${fieldId}/satellite-history?limit=200`,
        { headers }
      );
      if (!r.ok) throw new Error();
      const d = await r.json() as { history?: SatArtifact[] };
      const list = (d.history ?? []).sort((a, b) =>
        (b.scene_date ?? b.generated_at).localeCompare(a.scene_date ?? a.generated_at)
      );
      setArtifacts(list);
    } catch { /* silencioso */ }
    setLoadingArtifacts(false);
  }, []);

  useEffect(() => {
    if (selectedFieldId) void loadArtifacts(selectedFieldId);
  }, [selectedFieldId, loadArtifacts]);

  function handleSelectField(id: string) {
    setSelectedFieldId(id);
    setActiveField(id);
  }

  // ── Auto-buscar última imagem do satélite (NDVI + RGB) ─────────────────────
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchError, setAutoFetchError] = useState<string | null>(null);

  const autoFetchLatest = useCallback(async () => {
    if (!selectedFieldId || autoFetching) return;
    setAutoFetching(true);
    setAutoFetchError(null);
    try {
      const headers = await buildAuthHeaders();
      // 1. Buscar cenas disponíveis (Sentinel-2)
      const scenesResp = await fetch(
        `${API_URL}/api/sentinel/scenes?field_id=${selectedFieldId}&lookback_days=60`,
        { headers }
      );
      if (!scenesResp.ok) throw new Error('Falha ao buscar cenas do satélite');
      const scenesData = await scenesResp.json() as {
        s2: Array<{ scene_id: string; date: string; cloud_coverage: number | null; source: string }>;
      };
      const s2 = scenesData.s2 ?? [];
      // Escolhe a cena mais recente com menos de 30% de nuvens
      const bestScene = s2.find(s => (s.cloud_coverage ?? 100) <= 30) ?? s2[0];
      if (!bestScene) throw new Error('Nenhuma cena disponível nos últimos 60 dias');

      // 2. Gerar NDVI e RGB em paralelo
      const modes = ['ndvi', 'truecolor'];
      const results = await Promise.allSettled(modes.map(mode => {
        const params = new URLSearchParams({
          field_id: selectedFieldId,
          source: bestScene.source,
          scene_date: bestScene.date,
          scene_id: bestScene.scene_id,
          mode,
        });
        if (typeof bestScene.cloud_coverage === 'number') {
          params.set('cloud_coverage', String(bestScene.cloud_coverage));
        }
        return fetch(`${API_URL}/api/sentinel/overlay?${params}`, { headers });
      }));
      const anyOk = results.some(r => r.status === 'fulfilled' && r.value.ok);
      if (!anyOk) throw new Error('Falha ao gerar imagens');

      // 3. Recarrega artefatos
      await loadArtifacts(selectedFieldId);
    } catch (e) {
      setAutoFetchError(e instanceof Error ? e.message : 'Erro ao buscar imagem');
    } finally {
      setAutoFetching(false);
    }
  }, [selectedFieldId, autoFetching, loadArtifacts]);

  // ── Dividir artefatos por tipo ──────────────────────────────────────────────
  const ndviArtifacts = useMemo(
    () => artifacts.filter(a => a.mode === 'ndvi'),
    [artifacts]
  );
  const satArtifacts = useMemo(() => {
    const rgb = artifacts.filter(a => a.mode === 'truecolor' || a.mode === 'sar');
    // fallback: tudo que não for índice de vegetação
    return rgb.length > 0
      ? rgb
      : artifacts.filter(a => !['ndvi', 'ndre', 'evi', 'ndmi'].includes(a.mode));
  }, [artifacts]);

  const ndviSlot = useArtifactSlot(ndviArtifacts);
  const satSlot = useArtifactSlot(satArtifacts);

  // ── Modal de expansão (fullscreen) ─────────────────────────────────────────
  const [expanded, setExpanded] = useState<'ndvi' | 'sat' | null>(null);
  const expandedSlot = expanded === 'ndvi' ? ndviSlot : expanded === 'sat' ? satSlot : null;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // ── Modal de análise IA ─────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState<'ndvi' | 'sat' | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiArtifact = aiOpen === 'ndvi' ? ndviSlot.active : aiOpen === 'sat' ? satSlot.active : null;

  const analyzeWithAI = useCallback(async () => {
    if (!aiArtifact || !selectedField) return;
    setAiLoading(true); setAiError(null); setAiResult(null);
    try {
      const headers = await buildAuthHeaders();
      const body = {
        lat: selectedField.lat,
        lng: selectedField.lng,
        field_name: selectedField.name ?? 'Talhão',
        crop_type: selectedField.cultura ?? undefined,
        date_range_days: 30,
        boundaries: selectedField.boundaries ?? null,
        planting_date: selectedField.dataPlantio ?? undefined,
        variety: selectedField.variedade ?? undefined,
        area_ha: selectedField.areaHa ?? undefined,
      };
      const resp = await fetch(`${API_URL}/api/analyze-field`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        let msg = `Erro ${resp.status}`;
        try { const j = await resp.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* */ }
        throw new Error(msg);
      }
      const data = await resp.json() as { ai_report?: string };
      setAiResult(data.ai_report ?? 'Análise não disponível.');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erro na análise');
    } finally {
      setAiLoading(false);
    }
  }, [aiArtifact, selectedField]);

  // Dispara análise quando abre modal
  useEffect(() => {
    if (aiOpen && aiArtifact && !aiResult && !aiLoading && !aiError) {
      void analyzeWithAI();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpen]);

  useEffect(() => {
    if (!aiOpen) { setAiResult(null); setAiError(null); }
  }, [aiOpen]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar: lista de talhões ─────────────────────────────────────── */}
      <aside
        className="w-52 flex-shrink-0 flex flex-col border-r overflow-y-auto scrollbar-thin"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>

        <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>satellite_alt</span>
            <h1 className="text-sm font-black text-white">Imagens</h1>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Satélite por talhão</p>
        </div>

        <div className="p-2 flex flex-col gap-0.5">
          {farms.map(farm => {
            // Fix: store mantém fields no array top-level, não em farm.fields
            const farmFields = fields.filter(f => f.farm_id === farm.id);
            if (farmFields.length === 0) return null;
            return (
              <div key={farm.id}>
                <p
                  className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest truncate"
                  style={{ color: 'var(--muted)' }}>
                  {farm.name}
                </p>
                {farmFields.map(field => {
                  const isActive = field.id === selectedFieldId;
                  return (
                    <button
                      key={field.id}
                      onClick={() => field.id && handleSelectField(field.id)}
                      className="w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center gap-2"
                      style={isActive
                        ? { background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.35)' }
                        : { background: 'transparent', border: '1px solid transparent' }}>
                      <span
                        className="material-symbols-outlined text-base flex-shrink-0"
                        style={{ color: isActive ? 'var(--primary)' : '#475569' }}>
                        crop_square
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[12px] font-bold truncate"
                          style={{ color: isActive ? 'white' : 'var(--text, #e2e8f0)' }}>
                          {field.name}
                        </p>
                        <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>
                          {field.areaHa ? `${field.areaHa.toFixed(2)} ha` : '—'}
                          {field.cultura ? ` · ${field.cultura}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {/* Talhões sem fazenda */}
          {(() => {
            const farmIds = new Set(farms.map(f => f.id));
            const orphans = fields.filter(f => !f.farm_id || !farmIds.has(f.farm_id));
            if (orphans.length === 0) return null;
            return (
              <div>
                <p className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  Sem fazenda
                </p>
                {orphans.map(field => {
                  const isActive = field.id === selectedFieldId;
                  return (
                    <button
                      key={field.id}
                      onClick={() => field.id && handleSelectField(field.id)}
                      className="w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center gap-2"
                      style={isActive
                        ? { background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.35)' }
                        : { background: 'transparent', border: '1px solid transparent' }}>
                      <span className="material-symbols-outlined text-base flex-shrink-0"
                        style={{ color: isActive ? 'var(--primary)' : '#475569' }}>crop_square</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold truncate"
                          style={{ color: isActive ? 'white' : 'var(--text, #e2e8f0)' }}>{field.name}</p>
                        <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>
                          {field.areaHa ? `${field.areaHa.toFixed(2)} ha` : '—'}
                          {field.cultura ? ` · ${field.cultura}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {fields.length === 0 && (
            <p className="text-[11px] px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
              Nenhum talhão cadastrado
            </p>
          )}
        </div>
      </aside>

      {/* ── Área principal ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {!selectedField ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>satellite_alt</span>
            <p className="text-sm font-bold text-white">Selecione um talhão</p>
          </div>
        ) : (
          <>
            {/* Header do talhão — info completa do talhão selecionado */}
            <div
              className="flex-shrink-0 px-4 py-3 border-b"
              style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>
              <div className="flex items-start gap-3 flex-wrap">
                <span className="material-symbols-outlined text-2xl flex-shrink-0" style={{ color: 'var(--primary)' }}>
                  crop_square
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-white truncate">{selectedField.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                    {selectedField.areaHa != null && (
                      <span><strong className="text-white">{selectedField.areaHa.toFixed(2)}</strong> ha</span>
                    )}
                    {selectedField.cultura && (
                      <span>Cultura: <strong className="text-white">{selectedField.cultura}</strong></span>
                    )}
                    {selectedField.dataPlantio && (
                      <span>Plantio: <strong className="text-white">{(() => {
                        try { return new Date(selectedField.dataPlantio + 'T12:00:00').toLocaleDateString('pt-BR'); }
                        catch { return selectedField.dataPlantio; }
                      })()}</strong></span>
                    )}
                    {selectedField.variedade && (
                      <span>Variedade: <strong className="text-white">{selectedField.variedade}</strong></span>
                    )}
                    {artifacts.length > 0 && (
                      <span><strong className="text-white">{artifacts.length}</strong> imagens armazenadas</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => void loadArtifacts(selectedFieldId)}
                  disabled={loadingArtifacts}
                  title="Atualizar"
                  className="p-1.5 rounded-lg transition-all hover:bg-white/10 disabled:opacity-50 flex-shrink-0"
                  style={{ color: 'var(--muted)' }}>
                  <span className={`material-symbols-outlined text-base ${loadingArtifacts ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                </button>
              </div>
            </div>

            {/* Conteúdo */}
            {loadingArtifacts ? (
              <div className="flex-1 flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando imagens…</p>
              </div>
            ) : artifacts.length === 0 ? (
              /* Estado vazio — botão busca a última imagem automaticamente */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(236,91,19,0.1)' }}>
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--primary)' }}>
                    satellite_alt
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white mb-1">Nenhuma imagem armazenada</p>
                  <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--muted)' }}>
                    Buscamos a imagem mais recente do <strong className="text-white">Sentinel-2</strong> e
                    geramos o NDVI + Cor Real automaticamente.
                  </p>
                </div>
                <button
                  onClick={() => void autoFetchLatest()}
                  disabled={autoFetching || !selectedField?.boundaries || selectedField.boundaries.length < 3}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                  style={{ background: 'var(--primary)' }}>
                  {autoFetching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Buscando…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">cloud_download</span>
                      Buscar última imagem
                    </>
                  )}
                </button>
                {autoFetchError && (
                  <p className="text-[11px] max-w-xs text-center" style={{ color: '#f87171' }}>
                    {autoFetchError}
                  </p>
                )}
                {(!selectedField?.boundaries || selectedField.boundaries.length < 3) && (
                  <p className="text-[10px] text-center max-w-xs" style={{ color: '#475569' }}>
                    Talhão precisa ter polígono cadastrado.
                  </p>
                )}
              </div>
            ) : (
              /* ── Dois mapas + timeline ── */
              <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-hidden">

                {/* Grid responsivo: stack vertical em mobile, lado a lado em desktop */}
                <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
                  <MapCard
                    mapKey={`ndvi-${selectedFieldId}`}
                    label="NDVI"
                    artifacts={ndviArtifacts}
                    slot={ndviSlot}
                    fieldBoundaries={fieldBoundaries}
                    center={center}
                    mapBounds={mapBounds}
                    onExpand={() => setExpanded('ndvi')}
                    onAnalyze={() => setAiOpen('ndvi')}
                  />
                  <MapCard
                    mapKey={`sat-${selectedFieldId}`}
                    label="Satélite"
                    artifacts={satArtifacts}
                    slot={satSlot}
                    fieldBoundaries={fieldBoundaries}
                    center={center}
                    mapBounds={mapBounds}
                    onExpand={() => setExpanded('sat')}
                    onAnalyze={() => setAiOpen('sat')}
                  />
                </div>

                {/* Timeline: todos os artefatos */}
                <div className="flex-shrink-0 flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                  {artifacts.map(a => {
                    const mColor = MODE_COLOR[a.mode] ?? '#94a3b8';
                    const isNdviActive = a.id === ndviSlot.active?.id;
                    const isSatActive = a.id === satSlot.active?.id;
                    const isActive = isNdviActive || isSatActive;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          const ni = ndviArtifacts.findIndex(x => x.id === a.id);
                          const si = satArtifacts.findIndex(x => x.id === a.id);
                          if (ni >= 0) ndviSlot.setIdx(ni);
                          if (si >= 0) satSlot.setIdx(si);
                        }}
                        className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all"
                        style={isActive
                          ? { background: mColor + '20', border: `1px solid ${mColor}50` }
                          : { background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <span
                          className="text-[9px] font-black uppercase"
                          style={{ color: isActive ? mColor : 'var(--muted)' }}>
                          {MODE_LABEL[a.mode] ?? a.mode}
                        </span>
                        <span className="text-[11px] font-bold text-white whitespace-nowrap">
                          {fmtDate(a.scene_date ?? a.generated_at)}
                        </span>
                        {a.cloud_coverage != null && (
                          <span className="text-[9px]" style={{ color: '#475569' }}>
                            ☁ {a.cloud_coverage.toFixed(0)}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal de expansão (fullscreen) ───────────────────────────────── */}
      {expanded && expandedSlot && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => setExpanded(null)}>
          <div
            className="relative w-full h-full max-w-7xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: '#080809', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}>

            {/* Header do modal */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
              style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
              {expandedSlot.active && (
                <>
                  <span className="text-[11px] font-black px-2 py-1 rounded"
                    style={{
                      background: (MODE_COLOR[expandedSlot.active.mode] ?? '#94a3b8') + '25',
                      color: MODE_COLOR[expandedSlot.active.mode] ?? '#94a3b8',
                    }}>
                    {MODE_LABEL[expandedSlot.active.mode] ?? expandedSlot.active.mode.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {selectedField?.name} — {fmtDate(expandedSlot.active.scene_date ?? expandedSlot.active.generated_at)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {expandedSlot.active.source === 's2' ? 'Sentinel-2' : expandedSlot.active.source === 's1' ? 'Sentinel-1' : expandedSlot.active.source}
                      {expandedSlot.active.cloud_coverage != null && ` · ☁ ${expandedSlot.active.cloud_coverage.toFixed(0)}% nuvens`}
                    </p>
                  </div>
                </>
              )}

              {/* Navegação no modal */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => expandedSlot.setIdx(i => Math.max(0, i - 1))}
                  disabled={expandedSlot.idx <= 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/10">
                  <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>chevron_left</span>
                </button>
                <span className="text-[11px] tabular-nums px-2" style={{ color: 'var(--muted)' }}>
                  {expandedSlot.total > 0 ? `${expandedSlot.idx + 1}/${expandedSlot.total}` : '—'}
                </span>
                <button
                  onClick={() => expandedSlot.setIdx(i => Math.min(expandedSlot.total - 1, i + 1))}
                  disabled={expandedSlot.idx >= expandedSlot.total - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/10">
                  <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>chevron_right</span>
                </button>
              </div>

              <button
                onClick={() => { setAiOpen(expanded); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                style={{ background: 'rgba(236,91,19,0.15)', color: 'var(--primary)', border: '1px solid rgba(236,91,19,0.3)' }}>
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                Analisar com Tracto IA
              </button>

              <button
                onClick={() => setExpanded(null)}
                title="Fechar (ESC)"
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10">
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>close</span>
              </button>
            </div>

            {/* Mapa em fullscreen */}
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              {expandedSlot.url && mapBounds && fieldBoundaries.length >= 3 && (
                <MapContainer
                  key={`expand-${expanded}-${expandedSlot.active?.id ?? 'x'}`}
                  center={center}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                  attributionControl={false}>
                  <TileLayer
                    url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    subdomains={['0', '1', '2', '3']}
                    maxZoom={21}
                    maxNativeZoom={20}
                  />
                  <FitBounds bounds={mapBounds} />
                  <Polygon
                    positions={fieldBoundaries}
                    pathOptions={{
                      color: 'rgba(255,255,255,0.6)',
                      fill: false,
                      weight: 2,
                    }}
                  />
                  <ClippedImageOverlay
                    url={expandedSlot.url}
                    bounds={mapBounds}
                    fieldBoundaries={fieldBoundaries}
                  />
                </MapContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de análise IA ──────────────────────────────────────────── */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setAiOpen(null)}>
          <div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: '#0a0a0c', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}>

            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3"
              style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--primary)' }}>auto_awesome</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">Análise Tracto IA</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {selectedField?.name}
                  {aiArtifact && ` · ${MODE_LABEL[aiArtifact.mode] ?? aiArtifact.mode.toUpperCase()} · ${fmtDate(aiArtifact.scene_date ?? aiArtifact.generated_at)}`}
                </p>
              </div>
              <button
                onClick={() => setAiOpen(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {aiLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Analisando talhão com IA…</p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>Pode levar 10–30 segundos</p>
                </div>
              )}
              {aiError && !aiLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <span className="material-symbols-outlined text-3xl" style={{ color: '#f87171' }}>error</span>
                  <p className="text-sm font-bold" style={{ color: '#f87171' }}>Erro na análise</p>
                  <p className="text-xs text-center max-w-xs" style={{ color: 'var(--muted)' }}>{aiError}</p>
                  <button
                    onClick={() => void analyzeWithAI()}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'var(--primary)' }}>
                    Tentar novamente
                  </button>
                </div>
              )}
              {aiResult && !aiLoading && (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text, #e2e8f0)' }}>
                  {aiResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
