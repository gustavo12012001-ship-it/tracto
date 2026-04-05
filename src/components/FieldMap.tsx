import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polygon, Polyline, useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';
import { FALLBACK_LOCATION } from '../utils/geolocation';
import { supabase } from '../services/supabase';

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Map Click Handler ─────────────────────────────────────────────────────────
type DrawMode = 'none' | 'drawing';

type SentinelSceneResponse = {
  status: 'ok' | 'fallback';
  provider: string;
  display_mode: 'wms' | 'preview' | 'fallback';
  scene_date: string | null;
  scene_date_br: string | null;
  scene_id?: string | null;
  cloud_coverage?: number | null;
  wms_url?: string | null;
  wms_params?: {
    layers: string;
    format: string;
    transparent: boolean;
    time: string;
  } | null;
  preview_url?: string | null;
  message?: string | null;
};

type GeoSearchResult = {
  name: string;
  lat: number;
  lng: number;
  zoom?: number;
  bbox: [number, number, number, number] | {
    south: number;
    north: number;
    west: number;
    east: number;
  } | null;
};

function normalizeBBox(target: GeoSearchResult['bbox']): {
  south: number;
  north: number;
  west: number;
  east: number;
} | null {
  if (!target) return null;

  if (Array.isArray(target) && target.length === 4) {
    const [south, north, west, east] = target;
    return { south, north, west, east };
  }

  if (
    !Array.isArray(target)
    &&
    typeof target === 'object'
    && typeof target.south === 'number'
    && typeof target.north === 'number'
    && typeof target.west === 'number'
    && typeof target.east === 'number'
  ) {
    return {
      south: target.south,
      north: target.north,
      west: target.west,
      east: target.east,
    };
  }

  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function parseDMS(input: string): { lat: number; lng: number } | null {
  const dmsRegex =
    /^\s*(\d{1,2})[°º]\s*(\d{1,2})['’′]\s*(\d{1,2}(?:\.\d+)?)['"”″]?\s*([NS])\s+(\d{1,3})[°º]\s*(\d{1,2})['’′]\s*(\d{1,2}(?:\.\d+)?)['"”″]?\s*([EW])\s*$/i;
  const match = input.trim().match(dmsRegex);
  if (!match) return null;

  const latDeg = Number(match[1]);
  const latMin = Number(match[2]);
  const latSec = Number(match[3]);
  const latHemisphere = match[4].toUpperCase();

  const lngDeg = Number(match[5]);
  const lngMin = Number(match[6]);
  const lngSec = Number(match[7]);
  const lngHemisphere = match[8].toUpperCase();

  if (
    latMin >= 60 || latSec >= 60 || lngMin >= 60 || lngSec >= 60
    || latDeg > 90 || lngDeg > 180
  ) {
    return null;
  }

  const lat = (latDeg + latMin / 60 + latSec / 3600)
    * (latHemisphere === 'S' ? -1 : 1);
  const lng = (lngDeg + lngMin / 60 + lngSec / 3600)
    * (lngHemisphere === 'W' ? -1 : 1);

  return { lat, lng };
}

function parseCoordinateSearch(rawValue: string): { lat: number; lng: number } | null {
  const match = rawValue.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

function GeoSearchNavigator({ target }: { target: GeoSearchResult | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    const bbox = normalizeBBox(target.bbox);

    if (bbox) {
      map.flyToBounds(
        [
          [bbox.south, bbox.west],
          [bbox.north, bbox.east],
        ],
        {
          padding: [48, 48],
          maxZoom: 12,
          animate: true,
          duration: 1,
        },
      );
      return;
    }

    map.flyTo([target.lat, target.lng], target.zoom ?? 12, {
      animate: true,
      duration: 1,
    });
  }, [target, map]);

  return null;
}

// ── Map Controller (Auto-centering & Status) ───────────────────────────────
function MapController() {
  const map = useMap();
  const { currentLocation, locationStatus, fields, activeFieldId, activeFieldFocusToken } = useAppStore();
  const hasCenteredInitial = useRef(false);
  const prevActiveFieldId = useRef<string | null>(null);
  const previousFocusToken = useRef<number>(0);

  useEffect(() => {
    if (hasCenteredInitial.current) return;

    // 1. If we have an active field, go there
    if (activeFieldId) {
      const field = fields.find(f => f.id === activeFieldId);
      if (field) {
        map.setView([field.lat, field.lng], 15);
        hasCenteredInitial.current = true;
        return;
      }
    }

    // 2. If location is precise, go there
    if (locationStatus === 'precise' && currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], 13);
      hasCenteredInitial.current = true;
      return;
    }

    // 3. If location is fallback/denied but we have fields, center on first field
    if ((locationStatus === 'fallback' || locationStatus === 'denied' || locationStatus === 'unavailable') && fields.length > 0) {
      const firstField = fields[0];
      map.setView([firstField.lat, firstField.lng], 15);
      hasCenteredInitial.current = true;
    }
  }, [currentLocation, locationStatus, fields, activeFieldId, map]);

  useEffect(() => {
    const hasManualFocusRequest = previousFocusToken.current !== activeFieldFocusToken;
    previousFocusToken.current = activeFieldFocusToken;
    const hasFieldChanged = prevActiveFieldId.current !== activeFieldId;

    if (!activeFieldId) {
      prevActiveFieldId.current = null;
      return;
    }

    if (!hasFieldChanged && !hasManualFocusRequest) return;

    const field = fields.find((f) => f.id === activeFieldId);
    if (!field) return;

    if (field.boundaries && field.boundaries.length >= 3) {
      const bounds = L.latLngBounds(field.boundaries.map((point) => [point[0], point[1]] as [number, number]));
      map.flyToBounds(bounds, {
        padding: [48, 48],
        maxZoom: 17,
        animate: true,
        duration: 0.9,
      });
    } else {
      map.flyTo([field.lat, field.lng], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.9,
      });
    }
    prevActiveFieldId.current = activeFieldId;
  }, [activeFieldId, activeFieldFocusToken, fields, map]);

  return null;
}
const QUICK_CROPS = ['Soja', 'Milho', 'Sorgo', 'Algodão', 'Trigo', 'Cana-de-açúcar', 'Café'] as const;
const OTHER_CROP_VALUE = '__other__';

function ZoomControls({ zoomLocked }: { zoomLocked: boolean }) {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-auto">
      {[
        { s: '+', action: () => map.zoomIn() },
        { s: '−', action: () => map.zoomOut() },
      ].map(({ s, action }) => (
        <button
          key={s}
          onClick={() => {
            if (zoomLocked) return;
            action();
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:text-white"
          style={{
            background: 'rgba(8,8,9,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: zoomLocked ? '#64748b' : '#94a3b8',
            opacity: zoomLocked ? 0.55 : 1,
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function ZoomLocker({ active }: { active: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (active) {
      map.setZoom(18, { animate: true });
      map.setMinZoom(18);
      map.setMaxZoom(18);
    } else {
      map.setMinZoom(1);
      map.setMaxZoom(20);
      map.invalidateSize();
    }
  }, [active, map]);

  useEffect(() => {
    if (!active) return;

    const lock = () => {
      if (map.getZoom() !== 18) {
        map.setZoom(18, { animate: false });
      }
    };

    map.on('zoomend', lock);
    return () => {
      map.off('zoomend', lock);
    };
  }, [active, map]);

  return null;
}

function SentinelZoomController({ activeMapLayer }: { activeMapLayer: 'osm' | 'satellite' | 'sentinel' }) {
  const map = useMap();

  useEffect(() => {
    if (activeMapLayer !== 'sentinel') return;
    // Ao entrar em Sentinel, sempre força zoom 18
    // e gera remontagem via key={activeMapLayer} no MapContainer
    map.setZoom(18);
  }, [activeMapLayer, map]);

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FieldMap() {
  const {
    currentLocation,
    locationStatus,
    fields,
    createField,
    removeField,
    setActiveField,
    setMapLayer,
    focusActiveField,
    activeFieldId,
    activeFarmId,
    activeMapLayer,
  } = useAppStore();

  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [customCultura, setCustomCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');
  const [sentinelScene, setSentinelScene] = useState<SentinelSceneResponse | null>(null);
  const [isLoadingScene, setIsLoadingScene] = useState(false);
  const [layerControlOpen, setLayerControlOpen] = useState(false);
  const [savedFieldName, setSavedFieldName] = useState<string | null>(null);
  const [geoQuery, setGeoQuery] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoResult, setGeoResult] = useState<GeoSearchResult | null>(null);
  const [currentZoom, setCurrentZoom] = useState(13);
  const lastSentinelSceneRequestKeyRef = useRef<string | null>(null);

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng];

  const activeField = activeFieldId ? fields.find((field) => field.id === activeFieldId) : undefined;
  const activeFieldArea = activeField?.areaHa
    ?? (activeField?.boundaries && activeField.boundaries.length >= 3 ? polygonAreaHa(activeField.boundaries) : null);
  const requestLat = activeField?.lat ?? center[0];
  const requestLng = activeField?.lng ?? center[1];
  const activeBoundaries = activeField?.boundaries ?? null;
  const sentinelBoundaryKey = activeBoundaries ? JSON.stringify(activeBoundaries) : 'no-boundaries';
  const sentinelSceneRequestKey = activeFieldId
    ? `field:${activeFieldId}:${sentinelBoundaryKey}`
    : `center:${requestLat.toFixed(5)}:${requestLng.toFixed(5)}`;

  useEffect(() => {
    if (activeMapLayer !== 'sentinel') {
      lastSentinelSceneRequestKeyRef.current = null;
      return;
    }

    if (lastSentinelSceneRequestKeyRef.current === sentinelSceneRequestKey) return;
    lastSentinelSceneRequestKeyRef.current = sentinelSceneRequestKey;

    let isMounted = true;
    const controller = new AbortController();

    const loadScene = async () => {
      try {
        setIsLoadingScene(true);

        const payload = {
          lat: requestLat,
          lng: requestLng,
          boundaries: activeBoundaries,
          lookback_days: 21,
          max_cloud_coverage: 45,
        };

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        if (!authToken) {
          throw new Error('Sem sessao autenticada para consultar Sentinel-2.');
        }

        const response = await fetch(`${API_URL}/api/sentinel/latest-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Erro HTTP ${response.status}`);
        }

        const data = (await response.json()) as SentinelSceneResponse;
        if (isMounted) {
          setSentinelScene(data);
        }
      } catch {
        if (isMounted) {
          setSentinelScene({
            status: 'fallback',
            provider: 'Fallback local',
            display_mode: 'fallback',
            scene_date: null,
            scene_date_br: null,
            message: 'Falha ao buscar metadados Sentinel-2. Exibindo Satelite Esri.',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingScene(false);
        }
      }
    };

    void loadScene();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeMapLayer, activeFieldId, requestLat, requestLng, sentinelBoundaryKey, sentinelSceneRequestKey]);

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (drawMode !== 'drawing') return;
    setDrawPoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
  }, [drawMode]);

  const handleGeoSearch = useCallback(async () => {
    const normalized = geoQuery.trim();
    if (normalized.length < 3) {
      setGeoError('Digite pelo menos 3 caracteres para buscar.');
      return;
    }

    const dmsTarget = parseDMS(normalized);
    if (dmsTarget) {
      setGeoError(null);
      setGeoResult({
        name: `${dmsTarget.lat.toFixed(6)}, ${dmsTarget.lng.toFixed(6)}`,
        lat: dmsTarget.lat,
        lng: dmsTarget.lng,
        zoom: 15,
        bbox: null,
      });
      return;
    }

    const coordinateTarget = parseCoordinateSearch(normalized);
    if (coordinateTarget) {
      setGeoError(null);
      setGeoResult({
        name: `${coordinateTarget.lat.toFixed(6)}, ${coordinateTarget.lng.toFixed(6)}`,
        lat: coordinateTarget.lat,
        lng: coordinateTarget.lng,
        zoom: 15,
        bbox: null,
      });
      return;
    }

    try {
      setGeoLoading(true);
      setGeoError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) {
        throw new Error('Sessao expirada. Faça login novamente.');
      }

      const response = await fetch(`${API_URL}/api/geo/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ q: normalized }),
      });

      if (response.status === 404) {
        setGeoResult(null);
        setGeoError('Local não encontrado. Tente outra busca.');
        return;
      }

      if (response.status === 502 || response.status === 503) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        setGeoResult(null);
        setGeoError(payload?.detail ?? 'Serviço de busca geográfica indisponível no momento.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const data = (await response.json()) as GeoSearchResult;
      setGeoResult(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar local.';
      setGeoError(message);
    } finally {
      setGeoLoading(false);
    }
  }, [geoQuery]);

  const resetForm = () => {
    setDrawPoints([]);
    setFieldName('');
    setFieldCultura('');
    setCustomCultura('');
    setFieldDataPlantio('');
    setFieldVariedade('');
    setDrawMode('none');
  };

  const finishDrawing = async () => {
    // Validações obrigatórias (frontend guard)
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
      alert('A área desenhada é muito pequena. Desenhe um talhão com pelo menos 0.05 ha.');
      return;
    }

    const name = fieldName.trim() || `Talhão ${fields.length + 1}`;
    const resolvedCultura =
      fieldCultura === OTHER_CROP_VALUE ? customCultura.trim() : fieldCultura.trim();
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];

    const newLoc = {
      lat: centroid[0],
      lng: centroid[1],
      name,
      boundaries: drawPoints,
      cultura: resolvedCultura || undefined,
      dataPlantio: fieldDataPlantio || undefined,
      variedade: fieldVariedade || undefined,
      areaHa,
    };

    try {
      setIsSaving(true);
      await createField(activeFarmId, newLoc);
      focusActiveField();
      setSavedFieldName(name);
      window.setTimeout(() => setSavedFieldName(null), 3500);
      // Limpeza do formulário APENAS após sucesso confirmado
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar talhão.';
      alert(`Não foi possível salvar o talhão:\n${msg}`);
      // Intencionalmente NÃO limpa o formulário — permite corrigir e tentar de novo
    } finally {
      setIsSaving(false);
    }
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];
  const API_URL = import.meta.env.VITE_API_URL
    || 'https://tracto-production.up.railway.app';
  const sentinelNeedsZoomHint = activeMapLayer === 'sentinel' && currentZoom < 12;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: drawMode === 'drawing' ? 'crosshair' : 'default' }}
    >
      <MapContainer
        center={center}
        zoom={activeMapLayer === 'sentinel' ? 18 : 13}
        minZoom={3}
        maxZoom={20}
        scrollWheelZoom={activeMapLayer !== 'sentinel'}
        doubleClickZoom={activeMapLayer !== 'sentinel'}
        touchZoom={activeMapLayer !== 'sentinel'}
        keyboard={activeMapLayer !== 'sentinel'}
        style={{ height: '100%', width: '100%', background: '#080809' }}
        zoomControl={false}
      >
        <MapController />
        <SentinelZoomController activeMapLayer={activeMapLayer} />
        <ZoomLocker active={activeMapLayer === 'sentinel'} />
        <ZoomWatcher onZoomChange={setCurrentZoom} />
        <GeoSearchNavigator target={geoResult} />

        {/* Esri base - sempre visivel no satellite e sentinel */}
        {(activeMapLayer === 'satellite' || activeMapLayer === 'sentinel') && (
          <TileLayer
            attribution="© Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
          />
        )}

        {/* OSM */}
        {activeMapLayer === 'osm' && (
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        {/* Labels Esri — só no satellite */}
        {activeMapLayer === 'satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            opacity={0.6}
          />
        )}

        {/* Sentinel proxy por cima do Esri */}
        {activeMapLayer === 'sentinel' && (
          <TileLayer
            key="sentinel-proxy"
            url={`${import.meta.env.VITE_API_URL || 'https://tracto-production.up.railway.app'}/api/sentinel/tile/{z}/{x}/{y}`}
            attribution="© Copernicus Data Space (ESA)"
            minZoom={18}
            maxZoom={18}
            maxNativeZoom={18}
            opacity={1}
            tms={false}
            crossOrigin="anonymous"
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Current location marker */}
        {currentLocation && locationStatus === 'precise' && !fields.some((s) => s.lat === currentLocation.lat) && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}>
            <Popup>📍 Sua localização atual</Popup>
          </Marker>
        )}

        {geoResult && (
          <Marker position={[geoResult.lat, geoResult.lng]}>
            <Popup>🔎 {geoResult.name}</Popup>
          </Marker>
        )}

        {/* Fields from Supabase (single source of truth) */}
        {fields.map((loc, idx) => {
          const isActive = loc.id != null && loc.id === activeFieldId;
          const color = FIELD_COLORS[idx % FIELD_COLORS.length];
          return (
            <Polygon
              key={loc.id}  // UUID do banco — nunca usar idx aqui
              positions={
                loc.boundaries ??
                [
                  [loc.lat - 0.003, loc.lng - 0.003],
                  [loc.lat - 0.003, loc.lng + 0.003],
                  [loc.lat + 0.003, loc.lng + 0.003],
                  [loc.lat + 0.003, loc.lng - 0.003],
                ]
              }
              pathOptions={{
                color: isActive ? '#f97316' : color,
                fillColor: isActive ? '#f97316' : color,
                fillOpacity: isActive ? 0.34 : 0.18,
                weight: isActive ? 4 : 2,
                dashArray: isActive ? undefined : '4 4',
              }}
              eventHandlers={{
                click: () => {
                  if (loc.id) setActiveField(loc.id);
                },
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {isActive && <p style={{ fontSize: 10, color: '#ec5b13', marginBottom: 4, fontWeight: 700 }}>Talhão ativo</p>}
                  {loc.cultura && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🌱 {loc.cultura}</p>}
                  {loc.variedade && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🔬 {loc.variedade}</p>}
                  {loc.dataPlantio && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>📅 Plantio: {new Date(loc.dataPlantio).toLocaleDateString('pt-BR')}</p>}
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                    {loc.boundaries ? `${loc.boundaries.length} pontos` : 'Talhão'}
                  </p>
                  <button
                    onClick={() => activeFarmId && loc.id && removeField(activeFarmId, loc.id)}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    🗑 Remover talhão
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}


        {/* Preview of drawing */}
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
                  html: `<div style="width:10px;height:10px;background:#ec5b13;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
                  iconAnchor: [5, 5],
                })}
              />
            ))}
          </>
        )}

        {/* Functional zoom controls inside map */}
        <ZoomControls zoomLocked={activeMapLayer === 'sentinel'} />
      </MapContainer>

      {/* ── Overlays (outside MapContainer) ── */}

      {savedFieldName && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-[520] px-4 py-2 rounded-xl pointer-events-none"
          style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.35)', color: '#86efac', backdropFilter: 'blur(10px)' }}
        >
          <p className="text-xs font-bold">Talhão salvo: {savedFieldName}</p>
          <p className="text-[10px]" style={{ color: '#d1fae5' }}>Novo talhão ativo e em foco no mapa</p>
        </div>
      )}

      {drawMode === 'none' && activeField && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[510] px-4 py-3 rounded-2xl pointer-events-auto w-[min(92vw,460px)]"
          style={{ background: 'rgba(8,8,9,0.9)', backdropFilter: 'blur(14px)', border: '1px solid rgba(236,91,19,0.35)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#f97316' }}>Talhão ativo</p>
              <p className="text-sm font-bold text-white leading-tight">{activeField.name ?? 'Talhão sem nome'}</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>
                {activeFieldArea ? `${activeFieldArea.toFixed(2)} ha` : 'Área não calculada'}
                {activeField.cultura ? ` · ${activeField.cultura}` : ' · Cultura não informada'}
              </p>
              <p className="text-[10px]" style={{ color: '#64748b' }}>
                {activeField.dataPlantio ? `Plantio: ${new Date(activeField.dataPlantio).toLocaleDateString('pt-BR')}` : 'Plantio não informado'}
              </p>
            </div>
            <button
              onClick={() => focusActiveField()}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background: 'rgba(236,91,19,0.18)', border: '1px solid rgba(236,91,19,0.35)', color: '#f97316' }}
            >
              Focar
            </button>
          </div>
        </div>
      )}

      {drawMode === 'none' && !activeField && fields.length > 0 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[510] px-4 py-2.5 rounded-2xl pointer-events-none w-[min(90vw,420px)]"
          style={{ background: 'rgba(8,8,9,0.88)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#f97316' }}>Selecione um talhão</p>
          <p className="text-xs" style={{ color: '#e2e8f0' }}>Use a lista no canto inferior esquerdo para ativar e focar um talhão.</p>
        </div>
      )}

      {/* Layer Switcher — Compact Control */}
      {drawMode === 'none' && (
        <div className="absolute top-4 left-4 z-[510] pointer-events-auto">
          <button
            onClick={() => setLayerControlOpen((open) => !open)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(8,8,9,0.88)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', backdropFilter: 'blur(12px)' }}
          >
            <span className="material-symbols-outlined text-base">layers</span>
            Camadas
            <span className="material-symbols-outlined text-sm">{layerControlOpen ? 'expand_less' : 'expand_more'}</span>
          </button>

          {layerControlOpen && (
            <div
              className="mt-2 p-2 rounded-xl w-60"
              style={{ background: 'rgba(8,8,9,0.9)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(14px)' }}
            >
              <div className="flex flex-col gap-1">
                {[
                  { id: 'osm' as const, label: 'OpenStreetMap', icon: 'map', subtitle: '' },
                  { id: 'satellite' as const, label: 'Mapa Base (Alta Resolução)', icon: 'satellite', subtitle: 'Útil para desenhar talhões com precisão' },
                  { id: 'sentinel' as const, label: 'Sentinel-2 Atualizado', icon: 'satellite_alt', subtitle: '' },
                ].map(({ id, label, icon, subtitle }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setMapLayer(id);
                      setLayerControlOpen(false);
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left flex items-center gap-2"
                    style={{
                      background: activeMapLayer === id ? 'rgba(236,91,19,0.2)' : 'rgba(255,255,255,0.04)',
                      border: activeMapLayer === id ? '1px solid #ec5b13' : '1px solid rgba(255,255,255,0.08)',
                      color: activeMapLayer === id ? '#ec5b13' : '#94a3b8',
                    }}
                  >
                    <span className="material-symbols-outlined text-base">{icon}</span>
                    <div className="flex flex-col">
                      <span>{label}</span>
                      {subtitle && <span className="text-[9px] font-normal opacity-60 leading-tight">{subtitle}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {drawMode === 'none' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleGeoSearch();
          }}
          className="absolute top-16 left-4 z-[500] pointer-events-auto w-[min(92vw,360px)]"
        >
          <div
            className="px-2 py-2 rounded-xl"
            style={{ background: 'rgba(8,8,9,0.9)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: '#94a3b8' }}>travel_explore</span>
              <input
                type="text"
                value={geoQuery}
                onChange={(e) => {
                  setGeoQuery(e.target.value);
                  if (geoError) setGeoError(null);
                }}
                placeholder="Buscar cidade, município ou local"
                className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={geoLoading}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background: 'rgba(236,91,19,0.18)', border: '1px solid rgba(236,91,19,0.35)', color: '#f97316', opacity: geoLoading ? 0.7 : 1 }}
              >
                {geoLoading ? 'Buscando...' : 'Ir'}
              </button>
            </div>
            {!!geoError && <p className="text-[10px] mt-1.5" style={{ color: '#fca5a5' }}>{geoError}</p>}
            {!!geoResult && !geoError && (
              <p className="text-[10px] mt-1.5 truncate" style={{ color: '#94a3b8' }}>Resultado: {geoResult.name}</p>
            )}
          </div>
        </form>
      )}

      {/* Draw new field button */}
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

      {/* Drawing mode controls */}
      {drawMode === 'drawing' && (
        <>
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white pointer-events-none"
            style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,91,19,0.3)' }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>draw</span>
            Clique no mapa para marcar os vértices &nbsp;·&nbsp; {drawPoints.length} ponto{drawPoints.length !== 1 ? 's' : ''}
          </div>

          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto"
            style={{ background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 420 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>
              {drawPoints.length} pontos marcados · Novo Talhão
            </p>

            {/* Nome */}
            <input
              type="text"
              placeholder="Nome do talhão (ex: T01 – Soja Norte)"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full bg-transparent border-none text-sm focus:outline-none text-white placeholder:text-slate-600 border-b pb-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            />

            {/* Cultura + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>Cultura</p>
                <select
                  value={fieldCultura}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFieldCultura(value);
                    if (value !== OTHER_CROP_VALUE) setCustomCultura('');
                  }}
                  className="w-full bg-transparent text-sm focus:outline-none text-white cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
                >
                  <option value="" style={{ background: '#0c0c0e' }}>Selecionar...</option>
                  {QUICK_CROPS.map((crop) => (
                    <option key={crop} value={crop} style={{ background: '#0c0c0e' }}>{crop}</option>
                  ))}
                  <option value={OTHER_CROP_VALUE} style={{ background: '#0c0c0e' }}>Outro...</option>
                </select>
                {fieldCultura === OTHER_CROP_VALUE && (
                  <input
                    type="text"
                    placeholder="Digite a cultura personalizada"
                    value={customCultura}
                    onChange={(e) => setCustomCultura(e.target.value)}
                    className="w-full mt-2 bg-transparent text-sm focus:outline-none text-white placeholder:text-slate-500"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
                  />
                )}
              </div>
              <div>
                <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>Data de plantio</p>
                <input
                  type="date"
                  value={fieldDataPlantio}
                  onChange={(e) => setFieldDataPlantio(e.target.value)}
                  className="w-full text-sm focus:outline-none text-white cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Variedade */}
            <input
              type="text"
              placeholder="Variedade / Cultivar (ex: M7739, DM 66i68)"
              value={fieldVariedade}
              onChange={(e) => setFieldVariedade(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none text-white placeholder:text-slate-600"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
            />

            {/* Botões */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDrawPoints((p) => p.slice(0, -1))}
                disabled={drawPoints.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                onClick={finishDrawing}
                disabled={drawPoints.length < 3 || isSaving}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: '#ec5b13' }}
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Talhão'
                )}
              </button>
              <button
                onClick={() => { setDrawPoints([]); setFieldName(''); setFieldCultura(''); setCustomCultura(''); setFieldDataPlantio(''); setFieldVariedade(''); setDrawMode('none'); }}
                disabled={isSaving}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Fields control list */}
      {drawMode === 'none' && fields.length > 0 && (
        <div
          className="absolute bottom-4 left-4 z-[500] p-3 rounded-xl pointer-events-auto"
          style={{ background: 'rgba(8,8,9,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '250px', overflowY: 'auto', minWidth: '265px' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Talhões ({fields.length})</p>
          <div className="space-y-1.5">
            {fields.map((loc, i) => (
              <button
                key={loc.id}
                onClick={() => {
                  if (!loc.id) return;
                  setActiveField(loc.id);
                  focusActiveField();
                }}
                className="w-full flex items-center justify-between gap-2 text-xs px-2.5 py-2 rounded-lg transition-all"
                style={{
                  background: loc.id && loc.id === activeFieldId ? 'rgba(236,91,19,0.16)' : 'rgba(255,255,255,0.03)',
                  border: loc.id && loc.id === activeFieldId ? '1px solid rgba(236,91,19,0.45)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: FIELD_COLORS[i % FIELD_COLORS.length] }} />
                  <span className="truncate" style={{ color: loc.id && loc.id === activeFieldId ? '#f97316' : '#ffffff', fontWeight: loc.id && loc.id === activeFieldId ? 700 : 500 }}>
                    {loc.name ?? `Talhão ${i + 1}`}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: '#64748b' }}>
                  {loc.id && loc.id === activeFieldId ? 'Ativo' : 'Focar'}
                </span>
              </button>
            ))}
          </div>
          {activeMapLayer !== 'osm' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {activeMapLayer === 'satellite' && (
                <p className="text-[9px] font-semibold" style={{ color: '#f59e0b' }}>Mapa Base (Alta Resolução)</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Layer badge — standalone when no fields */}
      {drawMode === 'none' && fields.length === 0 && activeMapLayer === 'satellite' && (
        <div
          className="absolute bottom-4 left-4 z-[495] pointer-events-none px-3 py-2 rounded-xl text-[9px] font-semibold"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', backdropFilter: 'blur(10px)' }}
        >
          Mapa Base (Alta Resolução)
        </div>
      )}

      {drawMode === 'none' && activeMapLayer === 'sentinel' && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[505] pointer-events-none px-3.5 py-2 rounded-xl text-[10px] font-semibold"
          style={
            sentinelNeedsZoomHint
              ? { background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b', backdropFilter: 'blur(10px)' }
              : { background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80', backdropFilter: 'blur(10px)' }
          }
        >
          {sentinelNeedsZoomHint
            ? '🔍 Aproxime o mapa para ver as imagens do Sentinel-2'
            : `Sentinel-2 · Última cena: ${sentinelScene?.scene_date_br ?? 'Sem cena recente'}`}
        </div>
      )}

      {/* Sentinel scene status */}
      {activeMapLayer === 'sentinel' && (
        <div
          className="absolute bottom-4 right-4 z-[500] p-3 rounded-xl pointer-events-none text-[10px]"
          style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', maxWidth: '280px' }}
        >
          <p className="font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Sentinel-2 Atualizado</p>
          <div className="text-[9px] p-2 rounded" style={{ background: 'rgba(236,91,19,0.1)', border: '1px solid rgba(236,91,19,0.2)', color: '#f97316' }}>
            <p className="font-semibold mb-1">Ultima cena: {sentinelScene?.scene_date_br ?? 'Sem cena recente'}</p>
            <p className="text-[8px]" style={{ color: '#cbd5e1' }}>
              {isLoadingScene
                ? 'Consultando Earth Search STAC...'
                : 'Proxy de tiles Sentinel ativo (autenticado via backend Tracto)'}
            </p>
            {!!sentinelScene?.provider && (
              <p className="text-[8px] mt-1.5" style={{ color: '#94a3b8' }}>Fonte: {sentinelScene.provider}</p>
            )}
            {!!sentinelScene?.message && (
              <p className="text-[8px] mt-1.5" style={{ color: '#fca5a5' }}>{sentinelScene.message}</p>
            )}
          </div>
        </div>
      )}
      {/* Location Status Badge */}
      {locationStatus !== 'precise' && locationStatus !== 'loading' && (
        <div 
          className="absolute top-16 left-4 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider pointer-events-auto shadow-lg"
          style={{ 
            background: 'rgba(15, 23, 42, 0.85)', 
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            backdropFilter: 'blur(12px)'
          }}
        >
          <span className="material-symbols-outlined text-xs">location_off</span>
          {locationStatus === 'denied' ? 'GPS Negado' : 'Usando Localização de Fallback'}
          <button 
            onClick={() => window.location.reload()}
            className="ml-2 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
          >
            Atualizar
          </button>
        </div>
      )}

    </div>
  );
}
