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

type DrawMode = 'none' | 'drawing';

interface OverlayState {
  url: string | null;
  bounds: L.LatLngBoundsExpression | null;
  loading: boolean;
  error: string | null;
  fieldId: string | null;
}

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

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (latlng: { lat: number; lng: number }) => void;
}) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function MapController() {
  const map = useMap();
  const { currentLocation, locationStatus, fields, activeFieldId } = useAppStore();
  const hasCenteredInitial = useRef(false);

  useEffect(() => {
    if (hasCenteredInitial.current) return;

    if (activeFieldId) {
      const field = fields.find((f) => f.id === activeFieldId);
      if (field) {
        map.setView([field.lat, field.lng], 15);
        hasCenteredInitial.current = true;
        return;
      }
    }

    if (locationStatus === 'precise' && currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], 13);
      hasCenteredInitial.current = true;
      return;
    }

    if (
      (locationStatus === 'fallback' ||
        locationStatus === 'denied' ||
        locationStatus === 'unavailable') &&
      fields.length > 0
    ) {
      const firstField = fields[0];
      map.setView([firstField.lat, firstField.lng], 15);
      hasCenteredInitial.current = true;
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

    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
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

  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');
  const [sentinelActive, setSentinelActive] = useState(false);
  const [overlay, setOverlay] = useState<OverlayState>({
    url: null,
    bounds: null,
    loading: false,
    error: null,
    fieldId: null,
  });

  const prevUrlRef = useRef<string | null>(null);

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [-23.31028, -51.16278];

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

    const activeField = fields.find((f) => f.id === activeFieldId);
    if (!activeField) return;

    const fieldBoundaries = activeField.boundaries;
    if (!fieldBoundaries || fieldBoundaries.length < 3) {
      setOverlay((prev) => ({
        ...prev,
        error: 'Talhao sem poligono definido. Desenhe o talhao primeiro.',
        loading: false,
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
          {
            headers: await buildAuthHeaders(),
          },
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
        const msg = err instanceof Error ? err.message : 'Erro ao carregar imagem Sentinel.';
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

    return () => {
      cancelled = true;
    };
  }, [sentinelActive, activeFieldId, fields, overlay.fieldId, overlay.url]);

  useEffect(
    () => () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    },
    [],
  );

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
      alert('Selecione ou crie uma fazenda antes de desenhar talhoes.');
      return;
    }
    if (drawPoints.length < 3) {
      alert('Marque pelo menos 3 pontos para criar um talhao.');
      return;
    }

    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.05) {
      alert('A area desenhada e muito pequena. Desenhe um talhao com pelo menos 0.05 ha.');
      return;
    }

    const name = fieldName.trim() || `Talhao ${fields.length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];

    const newLoc = {
      lat: centroid[0],
      lng: centroid[1],
      name,
      boundaries: drawPoints,
      cultura: fieldCultura || undefined,
      dataPlantio: fieldDataPlantio || undefined,
      variedade: fieldVariedade || undefined,
      areaHa,
    };

    try {
      setIsSaving(true);
      await createField(activeFarmId, newLoc);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar talhao.';
      alert(`Nao foi possivel salvar o talhao:\n${msg}`);
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
        <MapController />

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

        {sentinelActive && overlay.url && overlay.bounds && (
          <ImageOverlay
            url={overlay.url}
            bounds={overlay.bounds}
            opacity={0.92}
            zIndex={400}
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {currentLocation &&
          locationStatus === 'precise' &&
          !fields.some((s) => s.lat === currentLocation.lat) && (
            <Marker position={[currentLocation.lat, currentLocation.lng]}>
              <Popup>Localizacao atual</Popup>
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
                fillOpacity: isActive ? 0.08 : 0.25,
                weight: isActive ? 3 : 2,
                dashArray: isActive ? undefined : '4 2',
              }}
              eventHandlers={{
                click: () => {
                  if (loc.id) setActiveField(loc.id);
                },
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.cultura && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      {loc.cultura}
                    </p>
                  )}
                  {loc.variedade && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      {loc.variedade}
                    </p>
                  )}
                  {loc.dataPlantio && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      Plantio: {new Date(loc.dataPlantio).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {loc.boundaries && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                      {polygonAreaHa(loc.boundaries).toFixed(2)} ha
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        if (loc.id) {
                          setActiveField(loc.id);
                          setSentinelActive(true);
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
                      onClick={() => activeFarmId && loc.id && removeField(activeFarmId, loc.id)}
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

      {drawMode === 'none' && (
        <div className="absolute top-4 left-4 z-[500] flex gap-2 pointer-events-auto">
          <button
            onClick={() => setSentinelActive(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: !sentinelActive ? 'rgba(236,91,19,0.9)' : 'rgba(8,8,9,0.82)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: !sentinelActive ? '#fff' : '#94a3b8',
            }}
          >
            Mapa Base
          </button>
          <button
            onClick={() => {
              setSentinelActive(true);
              if (!activeFieldId && fields.length > 0 && fields[0].id) {
                setActiveField(fields[0].id);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: sentinelActive ? 'rgba(236,91,19,0.9)' : 'rgba(8,8,9,0.82)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: sentinelActive ? '#fff' : '#94a3b8',
            }}
          >
            Sentinel-2
          </button>
        </div>
      )}

      {sentinelActive && (
        <div className="absolute top-14 left-4 z-[500] pointer-events-none">
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
              Sentinel-2 · True Color · Cache 30min
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
                maxWidth: 260,
              }}
            >
              {overlay.error.includes('503')
                ? 'Imagem indisponivel. Tente novamente em instantes.'
                : 'Erro ao carregar Sentinel'}
            </div>
          )}

          {!overlay.loading && sentinelActive && !activeFieldId && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold text-white"
              style={{
                background: 'rgba(8,8,9,0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              Selecione um talhao para ver o Sentinel
            </div>
          )}
        </div>
      )}

      {drawMode === 'none' && (
        <button
          onClick={() => setDrawMode('drawing')}
          className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 pointer-events-auto"
          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}
        >
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
            Clique no mapa para marcar os vertices · {drawPoints.length} ponto
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
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>
              {drawPoints.length} pontos marcados · Novo Talhao
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
                placeholder="Cultura"
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
                Area estimada: <span className="font-bold text-white">{polygonAreaHa(drawPoints).toFixed(2)} ha</span>
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={finishDrawing}
                disabled={isSaving || drawPoints.length < 3}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                style={{ background: '#ec5b13' }}
              >
                {isSaving ? 'Salvando...' : 'Salvar Talhao'}
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
