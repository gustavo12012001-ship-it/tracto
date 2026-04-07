// src/components/FieldMap.tsx — Versao 3.2
// Nome do talhao como tooltip no poligono
// Fly-to automatico ao selecionar talhao (topbar ou popup)
// Erro Sentinel com mensagem real para diagnostico
// Busca via Nominatim direto

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';
import { API_URL } from '../services/api';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type DrawMode = 'none' | 'drawing';
type MapLayer = 'osm' | 'esri' | 'sentinel';

interface OverlayState {
  url: string | null;
  bounds: L.LatLngBoundsExpression | null;
  loading: boolean;
  error: string | null;
  fieldId: string | null;
}

function computeBoundsFromBoundaries(b: [number, number][]): L.LatLngBoundsExpression {
  const lats = b.map((p) => p[0]);
  const lngs = b.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

function parseDecimalCoords(text: string): { lat: number; lng: number } | null {
  const m = text.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseDMSCoords(text: string): { lat: number; lng: number } | null {
  const r = /(\d+)[°º](\d+)'([\d.]+)"?([NSns])\s+(\d+)[°º](\d+)'([\d.]+)"?([EWew])/;
  const m = text.match(r);
  if (!m) return null;
  const dec = (d: number, min: number, sec: number, dir: string) => {
    const v = d + min / 60 + sec / 3600;
    return /[SW]/i.test(dir) ? -v : v;
  };
  return {
    lat: dec(+m[1], +m[2], +m[3], m[4]),
    lng: dec(+m[5], +m[6], +m[7], m[8]),
  };
}

async function buildAuthHeaders(): Promise<HeadersInit> {
  try {
    const { supabase } = await import('../services/supabase');
    let {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const r = await supabase.auth.refreshSession();
      session = r.data.session;
    }
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

function MapClickHandler({ onMapClick }: { onMapClick: (ll: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function FlyController({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  const prev = useRef<typeof target>(null);
  useEffect(() => {
    if (!target) return;
    if (prev.current?.lat === target.lat && prev.current?.lng === target.lng) return;
    prev.current = target;
    map.flyTo([target.lat, target.lng], target.zoom ?? 15, { duration: 1.2 });
  }, [target, map]);
  return null;
}

function ActiveFieldFlyController() {
  const map = useMap();
  const { fields, activeFieldId } = useAppStore();
  const prevFieldId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeFieldId) return;
    if (prevFieldId.current === activeFieldId) return;
    prevFieldId.current = activeFieldId;

    const field = fields.find((f) => f.id === activeFieldId);
    if (!field) return;

    if (field.boundaries && field.boundaries.length >= 3) {
      const bounds = computeBoundsFromBoundaries(field.boundaries);
      map.flyToBounds(bounds as L.LatLngBoundsExpression, { padding: [60, 60], duration: 1.2 });
    } else {
      map.flyTo([field.lat, field.lng], 15, { duration: 1.2 });
    }
  }, [activeFieldId, fields, map]);

  return null;
}

function InitialCenterController() {
  const map = useMap();
  const { currentLocation, locationStatus, fields } = useAppStore();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (fields.length > 0) {
      if (fields[0].boundaries && fields[0].boundaries.length >= 3) {
        map.flyToBounds(
          computeBoundsFromBoundaries(fields[0].boundaries) as L.LatLngBoundsExpression,
          { padding: [80, 80], duration: 0 },
        );
      } else {
        map.setView([fields[0].lat, fields[0].lng], 15);
      }
      done.current = true;
      return;
    }
    if (locationStatus === 'precise' && currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], 13);
      done.current = true;
    } else if (
      (locationStatus === 'fallback' ||
        locationStatus === 'denied' ||
        locationStatus === 'unavailable') &&
      currentLocation
    ) {
      map.setView([currentLocation.lat, currentLocation.lng], 11);
      done.current = true;
    }
  }, [currentLocation, locationStatus, fields, map]);

  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-auto">
      {[{ s: '+', a: () => map.zoomIn() }, { s: '-', a: () => map.zoomOut() }].map(({ s, a }) => (
        <button
          key={s}
          onClick={a}
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

  const [mapLayer, setMapLayer] = useState<MapLayer>('esri');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);

  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');

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
    : [-18.9188, -48.2768];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError(null);
    setTempMarker(null);

    const decimal = parseDecimalCoords(q);
    if (decimal) {
      setFlyTarget({ ...decimal, zoom: 15 });
      setTempMarker(decimal);
      return;
    }

    const dms = parseDMSCoords(q);
    if (dms) {
      setFlyTarget({ ...dms, zoom: 15 });
      setTempMarker(dms);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } },
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!data?.length) throw new Error('nao encontrado');
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setFlyTarget({ lat, lng, zoom: 13 });
      setTempMarker({ lat, lng });
    } catch {
      setSearchError('Local nao encontrado. Tente outro nome ou coordenadas.');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!sentinelActive || !activeFieldId) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
      setOverlay({ url: null, bounds: null, loading: false, error: null, fieldId: null });
      return;
    }
    if (overlay.fieldId === activeFieldId && overlay.url) return;

    const field = fields.find((f) => f.id === activeFieldId);
    if (!field) return;

    const fb = field.boundaries;
    if (!fb || fb.length < 3) {
      setOverlay((p) => ({
        ...p,
        error: 'Talhao sem poligono definido. Desenhe primeiro.',
        loading: false,
        fieldId: activeFieldId,
      }));
      return;
    }

    const bounds = computeBoundsFromBoundaries(fb);
    setOverlay({ url: null, bounds, loading: true, error: null, fieldId: activeFieldId });
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }

    let cancelled = false;
    const fetchOverlay = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/sentinel/overlay?field_id=${activeFieldId}`, {
          headers: await buildAuthHeaders(),
        });
        if (cancelled) return;
        if (!resp.ok) {
          const detail = await resp.text().catch(() => resp.statusText);
          throw new Error(`HTTP ${resp.status}: ${detail.slice(0, 200)}`);
        }
        const blob = await resp.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setOverlay({ url, bounds, loading: false, error: null, fieldId: activeFieldId });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
        console.error('[Sentinel overlay]', msg);
        setOverlay({ url: null, bounds, loading: false, error: msg, fieldId: activeFieldId });
      }
    };
    void fetchOverlay();
    return () => {
      cancelled = true;
    };
  }, [sentinelActive, activeFieldId, fields, overlay.fieldId, overlay.url]);

  useEffect(
    () => () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    },
    [],
  );

  const handleMapClick = useCallback(
    (ll: { lat: number; lng: number }) => {
      if (drawMode !== 'drawing') return;
      setDrawPoints((p) => [...p, [ll.lat, ll.lng]]);
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
      alert('Selecione uma fazenda antes de desenhar.');
      return;
    }
    if (drawPoints.length < 3) {
      alert('Marque pelo menos 3 pontos.');
      return;
    }
    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.05) {
      alert('Area muito pequena. Minimo 0.05 ha.');
      return;
    }

    const name = fieldName.trim() || `Talhao ${fields.length + 1}`;
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
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];

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
        <InitialCenterController />
        <ActiveFieldFlyController />
        <FlyController target={flyTarget} />

        {mapLayer === 'osm' && (
          <TileLayer
            attribution="&copy; OpenStreetMap"
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

        {sentinelActive && overlay.url && overlay.bounds && (
          <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.92} zIndex={400} />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {tempMarker && (
          <Marker position={[tempMarker.lat, tempMarker.lng]}>
            <Popup>{searchQuery}</Popup>
          </Marker>
        )}

        {currentLocation &&
          locationStatus === 'precise' &&
          !fields.some((s) => s.lat === currentLocation.lat) && (
            <Marker position={[currentLocation.lat, currentLocation.lng]}>
              <Popup>Sua localizacao atual</Popup>
            </Marker>
          )}

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
                fillOpacity: isActive ? 0.08 : 0.2,
                weight: isActive ? 3 : 2,
                dashArray: isActive ? undefined : '4 2',
              }}
              eventHandlers={{
                click: () => {
                  if (loc.id) setActiveField(loc.id);
                },
              }}
            >
              <Tooltip permanent direction="center" className="leaflet-field-label" offset={[0, 0]}>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    background: 'transparent',
                  }}
                >
                  {loc.name}
                </span>
              </Tooltip>

              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 190 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.cultura && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{loc.cultura}</p>
                  )}
                  {loc.variedade && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{loc.variedade}</p>
                  )}
                  {loc.dataPlantio && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      {new Date(loc.dataPlantio).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {loc.boundaries && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                      {polygonAreaHa(loc.boundaries).toFixed(2)} ha
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                      Ver Sentinel
                    </button>
                    <button
                      onClick={() => {
                        if (loc.id && activeFarmId && window.confirm(`Remover "${loc.name}"?`)) {
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
                      Remover
                    </button>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

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

      <style>{`
        .leaflet-field-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-field-label::before {
          display: none !important;
        }
      `}</style>

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
              border: `1px solid ${
                searchError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'
              }`,
            }}
          >
            <span
              className="material-symbols-outlined flex-shrink-0"
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
            className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
            style={{ background: '#ec5b13', flexShrink: 0 }}
          >
            Ir
          </button>
        </form>
      )}

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

      {drawMode === 'none' && (
        <div className="absolute top-4 left-4 z-[500] flex gap-1.5 pointer-events-auto">
          {(
            [
              { key: 'osm', label: 'OpenStreetMap' },
              { key: 'esri', label: 'Satelite HD' },
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
              className="px-3 py-2 rounded-xl text-[10px] font-bold"
              style={{
                background: 'rgba(8,8,9,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(74,222,128,0.25)',
                color: '#4ade80',
              }}
            >
              Sentinel-2 - True Color - Cache 30min
            </div>
          )}
          {!overlay.loading && overlay.error && (
            <div
              className="px-3 py-2 rounded-xl text-[10px] font-semibold"
              style={{
                background: 'rgba(8,8,9,0.88)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                maxWidth: 340,
              }}
            >
              {`Aviso: ${overlay.error}`}
            </div>
          )}
          {!overlay.loading && !overlay.url && !overlay.error && !activeFieldId && (
            <div
              className="px-3 py-2 rounded-xl text-[10px] font-semibold text-white"
              style={{
                background: 'rgba(8,8,9,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              Clique em um talhao e selecione Ver Sentinel
            </div>
          )}
        </div>
      )}

      {drawMode === 'none' && (
        <button
          onClick={() => setDrawMode('drawing')}
          className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 pointer-events-auto"
          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}
        >
          <span className="material-symbols-outlined text-base">add_location_alt</span>
          Desenhar Talhao
        </button>
      )}

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
            Clique para marcar vertices - {drawPoints.length} ponto{drawPoints.length !== 1 ? 's' : ''}
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
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>
              {drawPoints.length} pontos - Novo Talhao
            </p>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40"
              placeholder="Nome do talhao"
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
                Area: <span className="font-bold text-white">{polygonAreaHa(drawPoints).toFixed(2)} ha</span>
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={finishDrawing}
                disabled={isSaving || drawPoints.length < 3}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: '#ec5b13' }}
              >
                {isSaving ? 'Salvando...' : 'Salvar Talhao'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10"
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
