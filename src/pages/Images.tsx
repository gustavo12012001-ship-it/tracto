// src/pages/Images.tsx — Imagens de Satélite por Talhão
// Layout: sidebar de talhões + dois mapas lado a lado (NDVI e Satélite) com navegação por data

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { API_URL, buildAuthHeaders } from '../services/api';

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

// ── ClippedImageOverlay: recorta PNG ao polígono do talhão ────────────────────
function ClippedImageOverlay({
  url,
  bounds,
  fieldBoundaries,
}: {
  url: string;
  bounds: L.LatLngBoundsExpression;
  fieldBoundaries: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    const lb = bounds instanceof L.LatLngBounds
      ? bounds
      : L.latLngBounds(bounds as L.LatLngBoundsLiteral);
    const overlay = L.imageOverlay(url, lb, { opacity: 0.95 });
    overlay.addTo(map);

    function applyClip() {
      const el = overlay.getElement();
      if (!el || fieldBoundaries.length < 3) return;
      const sw = lb.getSouthWest();
      const ne = lb.getNorthEast();
      const latSpan = ne.lat - sw.lat;
      const lngSpan = ne.lng - sw.lng;
      if (!latSpan || !lngSpan) return;
      const pts = fieldBoundaries
        .map(([lat, lng]) => {
          const x = (((lng - sw.lng) / lngSpan) * 100).toFixed(2);
          const y = ((1 - (lat - sw.lat) / latSpan) * 100).toFixed(2);
          return `${x}% ${y}%`;
        })
        .join(', ');
      el.style.clipPath = `polygon(${pts})`;
    }

    overlay.on('load', applyClip);
    Promise.resolve().then(() => {
      const el = overlay.getElement();
      if (!el) { overlay.once('load', applyClip); return; }
      if (el.complete && el.naturalWidth > 0) {
        applyClip();
      } else {
        el.addEventListener('load', applyClip, { once: true });
      }
    });

    return () => {
      overlay.off('load', applyClip);
      map.removeLayer(overlay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, map]);
  return null;
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
}

function MapCard({ mapKey, label, artifacts: _artifacts, slot, fieldBoundaries, center, mapBounds }: MapCardProps) {
  const { idx, setIdx, url, loading, error, active, total } = slot;
  const modeColor = active ? (MODE_COLOR[active.mode] ?? '#94a3b8') : '#94a3b8';
  const modeLabel = active ? (MODE_LABEL[active.mode] ?? active.mode.toUpperCase()) : label;
  const dateLabel = active ? fmtDate(active.scene_date ?? active.generated_at) : '—';

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
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/10">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--muted)' }}>chevron_left</span>
          </button>
          <span className="text-[9px] tabular-nums w-8 text-center" style={{ color: '#475569' }}>
            {total > 0 ? `${idx + 1}/${total}` : '—'}
          </span>
          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            disabled={idx >= total - 1 || total === 0}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/10">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--muted)' }}>chevron_right</span>
          </button>
        </div>
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
          {farms.map(farm => (
            <div key={farm.id}>
              <p
                className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest truncate"
                style={{ color: 'var(--muted)' }}>
                {farm.name}
              </p>
              {farm.fields.map(field => {
                const isActive = field.id === selectedFieldId;
                return (
                  <button
                    key={field.id}
                    onClick={() => handleSelectField(field.id!)}
                    className="w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    style={isActive
                      ? { background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.35)' }
                      : { background: 'transparent', border: '1px solid transparent' }}>
                    <span
                      className="material-symbols-outlined text-base flex-shrink-0"
                      style={{ color: isActive ? 'var(--primary)' : '#475569' }}>
                      crop_square
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-[12px] font-bold truncate"
                        style={{ color: isActive ? 'white' : 'var(--text, #e2e8f0)' }}>
                        {field.name}
                      </p>
                      <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>
                        {field.areaHa ? `${field.areaHa} ha` : '—'} · {field.cultura ?? 'sem cultura'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
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
            {/* Header do talhão */}
            <div
              className="flex-shrink-0 px-4 py-2 border-b flex items-center gap-3"
              style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--primary)' }}>
                crop_square
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">{selectedField.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {selectedField.areaHa ? `${selectedField.areaHa} ha` : '—'}
                  {selectedField.cultura ? ` · ${selectedField.cultura}` : ''}
                  {artifacts.length > 0 ? ` · ${artifacts.length} imagens` : ''}
                </p>
              </div>
              <button
                onClick={() => void loadArtifacts(selectedFieldId)}
                disabled={loadingArtifacts}
                title="Atualizar"
                className="p-1.5 rounded-lg transition-all hover:bg-white/10 disabled:opacity-50"
                style={{ color: 'var(--muted)' }}>
                <span className={`material-symbols-outlined text-base ${loadingArtifacts ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>

            {/* Conteúdo */}
            {loadingArtifacts ? (
              <div className="flex-1 flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando imagens…</p>
              </div>
            ) : artifacts.length === 0 ? (
              /* Estado vazio */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(236,91,19,0.1)' }}>
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--primary)' }}>
                    satellite_alt
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white mb-1">Nenhuma imagem gerada ainda</p>
                  <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--muted)' }}>
                    Acesse <strong className="text-white">Mapas Agronômicos</strong>, selecione uma cena de
                    satélite e carregue a imagem. Ela será salva automaticamente aqui.
                  </p>
                </div>
                <a
                  href="/app/maps"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'var(--primary)' }}>
                  <span className="material-symbols-outlined text-base">map</span>
                  Ir para Mapas Agronômicos
                </a>
              </div>
            ) : (
              /* ── Dois mapas + timeline ── */
              <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-hidden">

                {/* Dois painéis de mapa lado a lado */}
                <div className="flex gap-3 flex-1 min-h-0">
                  <MapCard
                    mapKey={`ndvi-${selectedFieldId}`}
                    label="NDVI"
                    artifacts={ndviArtifacts}
                    slot={ndviSlot}
                    fieldBoundaries={fieldBoundaries}
                    center={center}
                    mapBounds={mapBounds}
                  />
                  <MapCard
                    mapKey={`sat-${selectedFieldId}`}
                    label="Satélite"
                    artifacts={satArtifacts}
                    slot={satSlot}
                    fieldBoundaries={fieldBoundaries}
                    center={center}
                    mapBounds={mapBounds}
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
    </div>
  );
}
