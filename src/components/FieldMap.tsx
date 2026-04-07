// src/components/FieldMap.tsx
// Versão 3.1 — Restaura OSM, busca por cidade/coords, auto-centro nos talhões
// Adiciona ImageOverlay Sentinel por talhão selecionado (Process API)

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';
import { API_URL } from '../services/api';

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

type DrawMode = 'none' | 'drawing';
type MapLayer = 'osm' | 'esri' | 'sentinel';

interface OverlayState {
  url: string | null;
  bounds: L.LatLngBoundsExpression | null;
  loading: boolean;
  error: string | null;
  fieldId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBoundsFromBoundaries(
  boundaries: [number, number][],
): L.LatLngBoundsExpression {
  const lats = boundaries.map((p) => p[0]);
  const lngs = boundaries.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

/** Parseia coordenadas decimais: "-18.919139, -49.287722" */
function parseDecimalCoords(text: string): { lat: number; lng: number } | null {
  const match = text.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Parseia coordenadas DMS: "18°55'08.9"S 49°17'15.8"W" */
function parseDMSCoords(text: string): { lat: number; lng: number } | null {
  const dmsRegex =
    /(\d+)[°º](\d+)'([\d.]+)"?([NSns])\s+(\d+)[°º](\d+)'([\d.]+)"?([EWew])/;
  const match = text.match(dmsRegex);
  if (!match) return null;

  const toDecimal = (deg: number, min: number, sec: number, dir: string) => {
    const d = deg + min / 60 + sec / 3600;
    return dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W' ? -d : d;
  };

  const lat = toDecimal(
    parseInt(match[1]),
    parseInt(match[2]),
    parseFloat(match[3]),
    match[4],
  );
  const lng = toDecimal(
    parseInt(match[5]),
    parseInt(match[6]),
    parseFloat(match[7]),
    match[8],
  );
  return { lat, lng };
}

async function buildAuthHeaders(): Promise<HeadersInit> {
  try {
    const { supabase } = await import('../services/supabase');
    let {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    return {};
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (latlng: { lat: number; lng: number }) => void;
}) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

/** Voa para um destino externo (busca por cidade ou coords) */
function FlyController({
  target,
}: {
  target: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  const prevTarget = useRef<typeof target>(null);

  useEffect(() => {
    if (!target) return;
    if (
      prevTarget.current?.lat === target.lat &&
      prevTarget.current?.lng === target.lng
    )
      return;
    prevTarget.current = target;
    map.flyTo([target.lat, target.lng], target.zoom ?? 15, { duration: 1.2 });
  }, [target, map]);

  return null;
}

/** Auto-centra no talhão ativo ou na localização atual — só na primeira carga */
function MapController() {
  const map = useMap();
  const { currentLocation, locationStatus, fields, activeFieldId } = useAppStore();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (hasCentered.current) return;

    // 1. Talhão ativo
    if (activeFieldId) {
      const field = fields.find((f) => f.id === activeFieldId);
      if (field) {
        map.setView([field.lat, field.lng], 15);
        hasCentered.current = true;
        return;
      }
    }

    // 2. Qualquer talhão cadastrado
    if (fields.length > 0) {
      map.setView([fields[0].lat, fields[0].lng], 15);
      hasCentered.current = true;
      return;
    }

    // 3. Localização precisa do usuário
    if (locationStatus === 'precise' && currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], 13);
      hasCentered.current = true;
      return;
    }

    // 4. Fallback / denied mas temos localização aproximada
    if (
      (locationStatus === 'fallback' ||
        locationStatus === 'denied' ||
        locationStatus === 'unavailable') &&
      currentLocation
    ) {
      map.setView([currentLocation.lat, currentLocation.lng], 11);
      hasCentered.current = true;
    }
  }, [currentLocation, locationStatus, fields, activeFieldId, map]);

  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-auto">
      {[
        { s: '+', action: () => map.zoomIn() },
        { s: '−', action: () => map.zoomOut() },
      ].map(({ s, action }) => (
        <button
          key={s}
          onClick={action}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:text-white"
          style={{
            background: 'rgba(8,8,9,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function FieldMap() {
  const {
    currentLocation,
    locationStatus,
    fields,
    createField,
    removeField,
    activeFarmId,
    activeFieldId,
    setActiveField,
  } = useAppStore();

  // ── Camada de mapa ────────────────────────────────────────────────────────
  const [mapLayer, setMapLayer] = useState<MapLayer>('esri');

  // ── Busca geográfica ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);

  // ── Desenho ───────────────────────────────────────────────────────────────
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');

  // ── Overlay Sentinel ──────────────────────────────────────────────────────
  const [overlay, setOverlay] = useState<OverlayState>({
    url: null,
    bounds: null,
    loading: false,
    error: null,
    fieldId: null,
  });
  const prevUrlRef = useRef<string | null>(null);

  const sentinelActive = mapLayer === 'sentinel';

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [-18.9188, -48.2768]; // Uberlândia como fallback

  // ── Busca geográfica ──────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearchError(null);
    setTempMarker(null);

    // Tenta coordenadas decimais primeiro
    const decimal = parseDecimalCoords(q);
    if (decimal) {
      setFlyTarget({ ...decimal, zoom: 15 });
      setTempMarker(decimal);
      return;
    }

    // Tenta DMS
    const dms = parseDMSCoords(q);
    if (dms) {
      setFlyTarget({ ...dms, zoom: 15 });
      setTempMarker(dms);
      return;
    }

    // Nominatim direto (sem backend)
    setSearchLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } },
      );
      const data = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (!data || data.length === 0) throw new Error('nao encontrado');

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setFlyTarget({ lat, lng, zoom: 13 });
      setTempMarker({ lat, lng });
    } catch {
      setSearchError('Local não encontrado. Tente outro nome ou use coordenadas.');
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Overlay Sentinel — busca quando talhão ativo muda ────────────────────
  useEffect(() => {
    if (!sentinelActive || !activeFieldId) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
      setOverlay({ url: null, bounds: null, loading: false, error: null, fieldId: null });
      return;
    }

    // Mesmo talhão já carregado — não rebuscar
    if (overlay.fieldId === activeFieldId && overlay.url) return;

    const activeField = fields.find((f) => f.id === activeFieldId);
    if (!activeField) return;

    const fieldBoundaries = activeField.boundaries;
    if (!fieldBoundaries || fieldBoundaries.length < 3) {
      setOverlay((prev) => ({
        ...prev,
        error: 'Talhão sem polígono definido. Desenhe o talhão primeiro.',
        loading: false,
        fieldId: activeFieldId,
      }));
      return;
    }

    const bounds = computeBoundsFromBoundaries(fieldBoundaries);

    setOverlay({
      url: null,
      bounds,
      loading: true,
      error: null,
      fieldId: activeFieldId,
    });

    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }

    let cancelled = false;

    const fetchOverlay = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/sentinel/overlay?field_id=${activeFieldId}`,
          { headers: await buildAuthHeaders() },
        );

        if (cancelled) return;

        if (!response.ok) {
          const detail = await response.text().catch(() => response.statusText);
          throw new Error(`[${response.status}] ${detail}`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        prevUrlRef.current = objectUrl;

        setOverlay({
          url: objectUrl,
          bounds,
          loading: false,
          error: null,
          fieldId: activeFieldId,
        });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'Erro ao carregar imagem Sentinel.';
        setOverlay({
          url: null,
          bounds,
          loading: false,
          error: msg,
          fieldId: activeFieldId,
        });
      }
    };

    void fetchOverlay();
    return () => { cancelled = true; };
  }, [sentinelActive, activeFieldId, fields, overlay.fieldId, overlay.url]);

  // Cleanup ao desmontar
  useEffect(
    () => () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    },
    [],
  );

  // ── Handlers de desenho ───────────────────────────────────────────────────
  const handleMapClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      if (drawMode !== 'drawing') return;
      setDrawPoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
    },
    [drawMode],
  );

  const resetForm = () => {
    setDrawPoints([]);
    setFieldName('');
    setFieldCultura('');
    setFieldDataPlantio('');
    setFieldVariedade('');
    setDrawMode('none');
  };

  const finishDrawing = async () => {
    if (!activeFarmId) {
      alert('Selecione ou crie uma fazenda antes de desenhar talhões.');
      return;
    }
    if (drawPoints.length < 3) {
      alert('Marque pelo menos 3 pontos para criar um talhão.');
      return;
    }
    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.05) {
      alert('A área desenhada é muito pequena. Mínimo 0.05 ha.');
      return;
    }

    const name = fieldName.trim() || `Talhão ${fields.length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];

    try {
      setIsSaving(true);
      await createField(activeFarmId, {
        lat: centroid[0],
        lng: centroid[1],
        name,
        boundaries: drawPoints,
        cultura: fieldCultura || undefined,
        dataPlantio: fieldDataPlantio || undefined,
        variedade: fieldVariedade || undefined,
        areaHa,
      });
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar talhão.';
      alert(`Não foi possível salvar o talhão:\n${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: drawMode === 'drawing' ? 'crosshair' : 'default' }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#080809' }}
        zoomControl={false}
      >
        <MapController />
        <FlyController target={flyTarget} />

        {/* ── Camadas base ── */}
        {mapLayer === 'osm' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        {(mapLayer === 'esri' || mapLayer === 'sentinel') && (
          <>
            <TileLayer
              attribution="&copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={20}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={20}
              opacity={0.6}
            />
          </>
        )}

        {/* ── ImageOverlay Sentinel (sobre base Esri) ── */}
        {sentinelActive && overlay.url && overlay.bounds && (
          <ImageOverlay
            url={overlay.url}
            bounds={overlay.bounds}
            opacity={0.92}
            zIndex={400}
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Marcador temporário de busca */}
        {tempMarker && (
          <Marker position={[tempMarker.lat, tempMarker.lng]}>
            <Popup>📍 {searchQuery}</Popup>
          </Marker>
        )}

        {/* Marcador de localização atual */}
        {currentLocation &&
          locationStatus === 'precise' &&
          !fields.some((s) => s.lat === currentLocation.lat) && (
            <Marker position={[currentLocation.lat, currentLocation.lng]}>
              <Popup>📍 Sua localização atual</Popup>
            </Marker>
          )}

        {/* Polígonos dos talhões */}
        {fields.map((loc, idx) => {
          const color = FIELD_COLORS[idx % FIELD_COLORS.length];
          const isActive = loc.id === activeFieldId;

          return (
            <Polygon
              key={loc.id}
              positions={
                loc.boundaries ?? [
                  [loc.lat - 0.001, loc.lng - 0.001],
                  [loc.lat - 0.001, loc.lng + 0.001],
                  [loc.lat + 0.001, loc.lng + 0.001],
                  [loc.lat + 0.001, loc.lng - 0.001],
                ]
              }
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isActive ? 0.08 : 0.25,
                weight: isActive ? 3 : 2,
                dashArray: isActive ? undefined : '4 2',
              }}
              eventHandlers={{
                click: () => { if (loc.id) setActiveField(loc.id); },
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.cultura && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      🌱 {loc.cultura}
                    </p>
                  )}
                  {loc.variedade && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      🔬 {loc.variedade}
                    </p>
                  )}
                  {loc.dataPlantio && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      📅 Plantio: {new Date(loc.dataPlantio).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {loc.boundaries && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                      📐 {polygonAreaHa(loc.boundaries).toFixed(2)} ha · {loc.boundaries.length} vértices
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        if (loc.id) {
                          setActiveField(loc.id);
                          setMapLayer('sentinel');
                        }
                      }}
                      style={{
                        fontSize: 11,
                        color: '#ec5b13',
                        background: 'rgba(236,91,19,0.1)',
                        border: '1px solid rgba(236,91,19,0.3)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      🛰 Ver Sentinel
                    </button>
                    <button
                      onClick={() => {
                        if (loc.id && activeFarmId) {
                          if (!window.confirm(`Remover o talhão "${loc.name}"? Esta ação não pode ser desfeita.`)) return;
                          removeField(activeFarmId, loc.id);
                        }
                      }}
                      style={{
                        fontSize: 11,
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      🗑 Remover
                    </button>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Preview do desenho em andamento */}
        {drawMode === 'drawing' && drawPoints.length > 0 && (
          <>
            {drawPoints.length > 1 && (
              <Polyline
                positions={[...drawPoints, drawPoints[0]]}
                pathOptions={{ color: '#ec5b13', weight: 2, dashArray: '6 4', opacity: 0.85 }}
              />
            )}
            {drawPoints.map((pt, i) => (
              <Marker
                key={i}
                position={pt}
                icon={L.divIcon({
                  className: '',
                  html: '<div style="width:10px;height:10px;background:#ec5b13;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>',
                  iconAnchor: [5, 5],
                })}
              />
            ))}
          </>
        )}

        <ZoomControls />
      </MapContainer>

      {/* ── Overlays fora do MapContainer ── */}

      {/* Barra de busca por cidade ou coordenadas */}
      {drawMode === 'none' && (
        <form
          onSubmit={handleSearch}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 pointer-events-auto"
          style={{ minWidth: 300 }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1"
            style={{
              background: 'rgba(8,8,9,0.88)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${searchError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            <span
              className="material-symbols-outlined text-base flex-shrink-0"
              style={{ color: '#64748b', fontSize: 18 }}
            >
              search
            </span>
            <input
              className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-slate-600 focus:outline-none"
              placeholder="Buscar cidade ou coordenadas..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError(null);
              }}
            />
            {searchLoading && (
              <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />
            )}
          </div>
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
            style={{ background: '#ec5b13', flexShrink: 0 }}
          >
            Ir
          </button>
        </form>
      )}

      {/* Erro de busca */}
      {searchError && drawMode === 'none' && (
        <div
          className="absolute z-[500] text-[10px] font-semibold px-3 py-1.5 rounded-lg pointer-events-none"
          style={{
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
          }}
        >
          {searchError}
        </div>
      )}

      {/* Seletor de camadas — canto superior esquerdo */}
      {drawMode === 'none' && (
        <div className="absolute top-4 left-4 z-[500] flex gap-1.5 pointer-events-auto">
          {(
            [
              { key: 'osm', label: 'OpenStreetMap' },
              { key: 'esri', label: 'Satélite HD' },
              { key: 'sentinel', label: 'Sentinel-2' },
            ] as { key: MapLayer; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setMapLayer(key);
                if (key === 'sentinel' && !activeFieldId && fields.length > 0 && fields[0].id) {
                  setActiveField(fields[0].id);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background:
                  mapLayer === key ? 'rgba(236,91,19,0.9)' : 'rgba(8,8,9,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: mapLayer === key ? '#fff' : '#94a3b8',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Badge de status do Sentinel */}
      {sentinelActive && (
        <div className="absolute z-[500] pointer-events-none" style={{ top: 52, left: 4 }}>
          {overlay.loading && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white"
              style={{
                background: 'rgba(8,8,9,0.88)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(236,91,19,0.3)',
              }}
            >
              <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
              Carregando imagem Sentinel...
            </div>
          )}

          {!overlay.loading && overlay.url && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold"
              style={{
                background: 'rgba(8,8,9,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(74,222,128,0.25)',
                color: '#4ade80',
              }}
            >
              🛰 Sentinel-2 · True Color · Cache 30min
            </div>
          )}

          {!overlay.loading && overlay.error && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold"
              style={{
                background: 'rgba(8,8,9,0.88)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                maxWidth: 280,
              }}
            >
              {overlay.error.includes('503') || overlay.error.includes('504')
                ? '⚠ Imagem indisponível — tente novamente em instantes'
                : overlay.error.includes('sem polígono')
                ? '⚠ Talhão sem polígono. Desenhe o perímetro primeiro.'
                : '⚠ Erro ao carregar Sentinel'}
            </div>
          )}

          {!overlay.loading && !overlay.url && !overlay.error && !activeFieldId && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold text-white"
              style={{
                background: 'rgba(8,8,9,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              👆 Clique em um talhão e selecione "Ver Sentinel"
            </div>
          )}
        </div>
      )}

      {/* Botão Desenhar Talhão */}
      {drawMode === 'none' && (
        <button
          onClick={() => setDrawMode('drawing')}
          className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 pointer-events-auto"
          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}
        >
          <span className="material-symbols-outlined text-base">add_location_alt</span>
          Desenhar Talhão
        </button>
      )}

      {/* Controles de desenho */}
      {drawMode === 'drawing' && (
        <>
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white pointer-events-none"
            style={{
              background: 'rgba(8,8,9,0.92)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(236,91,19,0.3)',
            }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>
              draw
            </span>
            Clique no mapa para marcar os vértices · {drawPoints.length} ponto
            {drawPoints.length !== 1 ? 's' : ''}
          </div>

          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto"
            style={{
              background: 'rgba(8,8,9,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.09)',
              minWidth: 420,
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: '#ec5b13' }}
            >
              {drawPoints.length} pontos marcados · Novo Talhão
            </p>

            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40"
              placeholder="Nome do talhão (ex: Talhão Norte)"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40"
                placeholder="Cultura (ex: Soja)"
                value={fieldCultura}
                onChange={(e) => setFieldCultura(e.target.value)}
              />
              <input
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40"
                placeholder="Variedade"
                value={fieldVariedade}
                onChange={(e) => setFieldVariedade(e.target.value)}
              />
            </div>

            <input
              type="date"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-orange-500/40"
              value={fieldDataPlantio}
              onChange={(e) => setFieldDataPlantio(e.target.value)}
            />

            {drawPoints.length >= 3 && (
              <p className="text-[10px] text-slate-400 text-center">
                Área estimada:{' '}
                <span className="font-bold text-white">
                  {polygonAreaHa(drawPoints).toFixed(2)} ha
                </span>
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={finishDrawing}
                disabled={isSaving || drawPoints.length < 3}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                style={{ background: '#ec5b13' }}
              >
                {isSaving ? 'Salvando...' : 'Salvar Talhão'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#94a3b8',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
