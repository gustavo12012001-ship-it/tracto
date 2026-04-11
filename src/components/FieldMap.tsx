// src/components/FieldMap.tsx — Versão 4.0
// Painel de cenas Sentinel-1 e Sentinel-2 disponíveis por talhão
// O usuário vê as datas disponíveis e escolhe qual carregar

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

// ── Tipos ─────────────────────────────────────────────────────────────────────

type DrawMode = 'none' | 'drawing';
type MapLayer = 'osm' | 'esri';

interface PlanetLayerState {
  sceneId: string | null;
  enabled: boolean;
}

interface SentinelScene {
  scene_id: string;
  date: string;
  date_br: string;
  cloud_coverage: number | null;
  source: 's1' | 's2' | 'planet';
  collection: string;
  thumbnail_url: string | null;
  orbit?: string;
}

interface ScenesState {
  s2: SentinelScene[];
  s1: SentinelScene[];
  planet: SentinelScene[];
  loading: boolean;
  error: string | null;
  fieldId: string | null;
}

interface OverlayState {
  url: string | null;
  bounds: L.LatLngBoundsExpression | null;
  loading: boolean;
  error: string | null;
  sceneKey: string | null; // "field_id|source|scene_id"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBoundsFromBoundaries(b: [number, number][]): L.LatLngBoundsExpression {
  const lats = b.map((p) => p[0]);
  const lngs = b.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

function parseDecimalCoords(text: string): { lat: number; lng: number } | null {
  const m = text.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
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
  return { lat: dec(+m[1], +m[2], +m[3], m[4]), lng: dec(+m[5], +m[6], +m[7], m[8]) };
}

async function buildAuthHeaders(): Promise<HeadersInit> {
  const { supabase } = await import('../services/supabase');
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const r = await supabase.auth.refreshSession();
    session = r.data.session;
  }
  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

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
    if (!activeFieldId || prevFieldId.current === activeFieldId) return;
    prevFieldId.current = activeFieldId;
    const field = fields.find((f) => f.id === activeFieldId);
    if (!field) return;
    if (field.boundaries && field.boundaries.length >= 3) {
      map.flyToBounds(computeBoundsFromBoundaries(field.boundaries) as L.LatLngBoundsExpression, { padding: [60, 60], duration: 1.2 });
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
        map.flyToBounds(computeBoundsFromBoundaries(fields[0].boundaries) as L.LatLngBoundsExpression, { padding: [80, 80], duration: 0 });
      } else {
        map.setView([fields[0].lat, fields[0].lng], 15);
      }
      done.current = true;
      return;
    }
    if (locationStatus === 'precise' && currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], 13);
      done.current = true;
    } else if ((locationStatus === 'fallback' || locationStatus === 'denied' || locationStatus === 'unavailable') && currentLocation) {
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
      {[{ s: '+', a: () => map.zoomIn() }, { s: '−', a: () => map.zoomOut() }].map(({ s, a }) => (
        <button key={s} onClick={a} className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:text-white"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Card de cena ──────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  isActive,
  isLoading,
  onClick,
}: {
  scene: SentinelScene;
  isActive: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const isS2 = scene.source === 's2';
  const isPlanet = scene.source === 'planet';
  const cloudOk = scene.cloud_coverage !== null && scene.cloud_coverage <= 30;
  const cloudMid = scene.cloud_coverage !== null && scene.cloud_coverage > 30 && scene.cloud_coverage <= 60;

  const iconName = isS2 ? 'satellite_alt' : isPlanet ? 'public' : 'radar';
  const iconColor = isS2 ? '#60a5fa' : isPlanet ? '#34d399' : '#a78bfa';
  const iconBg = isS2 ? 'rgba(96,165,250,0.15)' : isPlanet ? 'rgba(52,211,153,0.15)' : 'rgba(167,139,250,0.15)';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-2.5 transition-all flex items-center gap-3"
      style={{
        background: isActive ? 'rgba(236,91,19,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isActive ? 'rgba(236,91,19,0.5)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {/* Ícone */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        <span className="material-symbols-outlined text-sm" style={{ color: iconColor }}>
          {iconName}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white leading-tight">{scene.date_br}</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>
          {isS2
            ? scene.cloud_coverage !== null
              ? `☁ ${scene.cloud_coverage.toFixed(0)}% nuvens`
              : 'Cobertura N/D'
            : isPlanet
              ? 'PlanetScope · resolução aprox. 3m'
              : scene.orbit
                ? `Órbita ${scene.orbit}`
                : 'SAR · Radar'
          }
        </p>
      </div>

      {/* Badge qualidade: nuvens no S2, resolução no Planet */}
      {isS2 && scene.cloud_coverage !== null && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            background: cloudOk ? 'rgba(74,222,128,0.15)' : cloudMid ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
            color: cloudOk ? '#4ade80' : cloudMid ? '#fbbf24' : '#f87171',
          }}>
          {cloudOk ? 'LIMPO' : cloudMid ? 'PARCIAL' : 'NUBLADO'}
        </span>
      )}
      {isPlanet && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
          ≈3m
        </span>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin flex-shrink-0" />
      )}
    </button>
  );
}

// ── Painel de cenas ───────────────────────────────────────────────────────────

function ScenesPanel({
  fieldId,
  fieldName,
  scenes,
  activeSceneKey,
  overlayLoading,
  onClose,
  onSelectScene,
}: {
  fieldId: string;
  fieldName: string;
  scenes: ScenesState;
  activeSceneKey: string | null;
  overlayLoading: boolean;
  onClose: () => void;
  onSelectScene: (scene: SentinelScene) => void;
}) {
  const [tab, setTab] = useState<'s2' | 's1' | 'planet'>('s2');

  const currentScenes = tab === 's2' ? scenes.s2 : tab === 's1' ? scenes.s1 : scenes.planet;

  return (
    <div
      className="absolute top-4 right-16 z-[500] flex flex-col rounded-2xl overflow-hidden pointer-events-auto"
      style={{
        background: 'rgba(8,8,9,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.09)',
        width: 280,
        maxHeight: 'calc(100vh - 100px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <p className="text-xs font-bold text-white">Imagens Satelitais</p>
          <p className="text-[10px] mt-0.5 truncate max-w-[180px]" style={{ color: '#64748b' }}>{fieldName}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all" style={{ color: '#64748b' }}>
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {([
          { key: 's2', label: 'Sentinel-2', icon: 'satellite_alt', color: '#60a5fa', desc: 'Óptico · RGB' },
          { key: 's1', label: 'Sentinel-1', icon: 'radar', color: '#a78bfa', desc: 'Radar · SAR' },
          { key: 'planet', label: 'Planet', icon: 'public', color: '#34d399', desc: 'Alta Res · 3m' },
        ] as const).map(({ key, label, icon, color, desc }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
            style={{
              background: tab === key ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${tab === key ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: tab === key ? color : '#64748b' }}>{icon}</span>
            <span className="text-[10px] font-bold" style={{ color: tab === key ? '#fff' : '#64748b' }}>{label}</span>
            <span className="text-[9px]" style={{ color: '#475569' }}>{desc}</span>
          </button>
        ))}
      </div>

      {/* Lista de cenas */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5" style={{ maxHeight: 340 }}>
        {scenes.loading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-[10px]" style={{ color: '#64748b' }}>Buscando imagens disponíveis...</p>
          </div>
        ) : scenes.error ? (
          <div className="py-6 text-center px-4">
            <span className="material-symbols-outlined text-2xl block mb-2" style={{ color: '#f87171' }}>cloud_off</span>
            <p className="text-[10px] font-semibold mb-1" style={{ color: '#f87171' }}>Falha ao buscar cenas</p>
            <p className="text-[10px]" style={{ color: '#64748b' }}>{scenes.error}</p>
          </div>
        ) : currentScenes.length === 0 ? (
          <div className="py-6 text-center">
            <span className="material-symbols-outlined text-2xl block mb-2" style={{ color: '#334155' }}>
              {tab === 's2' ? 'cloud_off' : tab === 's1' ? 'signal_disconnected' : 'public_off'}
            </span>
            <p className="text-[10px]" style={{ color: '#64748b' }}>
              {tab === 's2' ? 'Nenhuma imagem Sentinel-2 nos últimos 90 dias.' : tab === 's1' ? 'Nenhuma imagem Sentinel-1 nos últimos 90 dias.' : 'Nenhuma imagem Planet nos últimos 90 dias.'}
            </p>
          </div>
        ) : (
          currentScenes.map((scene) => {
            const key = `${fieldId}|${scene.source}|${scene.scene_id}`;
            return (
              <SceneCard
                key={scene.scene_id}
                scene={scene}
                isActive={activeSceneKey === key}
                isLoading={overlayLoading && activeSceneKey === key}
                onClick={() => onSelectScene(scene)}
              />
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 py-2.5 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] text-center" style={{ color: '#334155' }}>
          {tab === 'planet'
            ? 'Fonte: Planet Labs · Cena PlanetScope (footprint da cena)'
            : 'Catálogo: Copernicus · Earth Search STAC (gratuito)'}
        </p>
        {tab !== 'planet' && (
          <p className="text-[9px] text-center" style={{ color: '#1e3a5f' }}>
            Renderização: Sentinel Hub Processing API (requer credenciais)
          </p>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function FieldMap() {
  const { currentLocation, locationStatus, fields, createField, removeField, activeFarmId, activeFieldId, setActiveField } = useAppStore();

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

  // Painel de cenas
  const [showScenesPanel, setShowScenesPanel] = useState(false);
  const [scenes, setScenes] = useState<ScenesState>({ s2: [], s1: [], planet: [], loading: false, error: null, fieldId: null });

  // Overlay
  const [overlay, setOverlay] = useState<OverlayState>({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
  const [planetLayer, setPlanetLayer] = useState<PlanetLayerState>({ sceneId: null, enabled: false });
  const prevUrlRef = useRef<string | null>(null);
  const loadingScenesFieldRef = useRef<string | null>(null);
  const planetTileErrorCountRef = useRef(0);

  const center: [number, number] = currentLocation ? [currentLocation.lat, currentLocation.lng] : [-18.9188, -48.2768];

  // ── Buscar cenas quando painel abre ──────────────────────────────────────
  useEffect(() => {
    if (!showScenesPanel || !activeFieldId) return;
    if (scenes.fieldId === activeFieldId && !scenes.loading) return;
    if (loadingScenesFieldRef.current === activeFieldId) return;

    loadingScenesFieldRef.current = activeFieldId;
    setScenes({ s2: [], s1: [], planet: [], loading: true, error: null, fieldId: activeFieldId });

    const fetchScenes = async () => {
      try {
        const headers = await buildAuthHeaders();
        const [sentinelResp, planetResp] = await Promise.allSettled([
          fetch(`${API_URL}/api/sentinel/scenes?field_id=${activeFieldId}&lookback_days=90`, { headers }),
          fetch(`${API_URL}/api/planet/scenes?field_id=${activeFieldId}&lookback_days=90`, { headers }),
        ]);

        const sentinelData = sentinelResp.status === 'fulfilled' && sentinelResp.value.ok
          ? await sentinelResp.value.json()
          : { s2: [], s1: [] };

        const planetData = planetResp.status === 'fulfilled' && planetResp.value.ok
          ? await planetResp.value.json()
          : { scenes: [] };

        setScenes({
          s2: sentinelData.s2 || [],
          s1: sentinelData.s1 || [],
          planet: planetData.scenes || [],
          loading: false,
          error: null,
          fieldId: activeFieldId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao buscar cenas.';
        setScenes({ s2: [], s1: [], planet: [], loading: false, error: msg, fieldId: activeFieldId });
      } finally {
        if (loadingScenesFieldRef.current === activeFieldId) {
          loadingScenesFieldRef.current = null;
        }
      }
    };

    void fetchScenes();
  }, [showScenesPanel, activeFieldId, scenes.fieldId, scenes.loading]);

  // ── Carregar overlay de cena selecionada ──────────────────────────────────
  const handleSelectScene = async (scene: SentinelScene) => {
    if (!activeFieldId) return;
    const source = scene.source;
    const date = scene.date || '';
    const sceneId = scene.scene_id;

    const sceneKey = `${activeFieldId}|${source}|${sceneId}`;
    if (source === 'planet' && overlay.sceneKey === sceneKey && planetLayer.sceneId && planetLayer.enabled) return;
    if (source !== 'planet' && overlay.sceneKey === sceneKey && overlay.url) return; // já carregado

    const activeField = fields.find((f) => f.id === activeFieldId);
    if (!activeField?.boundaries || activeField.boundaries.length < 3) return;

    const bounds = computeBoundsFromBoundaries(activeField.boundaries);

    setOverlay({ url: null, bounds, loading: true, error: null, sceneKey });
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }

    try {
      const headers = await buildAuthHeaders();

      if (source === 'planet') {
        if (!sceneId) return;
        const resp = await fetch(`${API_URL}/api/planet/tile-session?field_id=${activeFieldId}&scene_id=${sceneId}`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
        if (!resp.ok) {
          let errorMsg = `Erro ${resp.status}`;
          try {
            const payload = await resp.json() as { detail?: string };
            errorMsg = payload.detail || errorMsg;
          } catch {
            errorMsg = await resp.text().catch(() => errorMsg);
          }
          throw new Error(errorMsg);
        }
        planetTileErrorCountRef.current = 0;
        setPlanetLayer({ sceneId, enabled: true });
        setOverlay({ url: null, bounds, loading: false, error: null, sceneKey });
        return;
      }

      setPlanetLayer({ sceneId: null, enabled: false });

      const url = `${API_URL}/api/sentinel/overlay?field_id=${activeFieldId}&source=${source}&scene_date=${date}`;
      const resp = await fetch(url, { headers });

      if (!resp.ok) {
        let errorMsg = `Erro ${resp.status}`;
        try {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const json = await resp.json() as { detail?: string };
            errorMsg = json.detail || errorMsg;
          } else {
            const text = await resp.text();
            // tenta parsear JSON mesmo sem content-type correto
            try {
              const json = JSON.parse(text) as { detail?: string };
              errorMsg = json.detail || text.slice(0, 200) || errorMsg;
            } catch {
              errorMsg = text.slice(0, 200) || errorMsg;
            }
          }
        } catch { /* mantém errorMsg padrão */ }
        throw new Error(errorMsg);
      }

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      prevUrlRef.current = objectUrl;
      setOverlay({ url: objectUrl, bounds, loading: false, error: null, sceneKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar imagem.';
      console.error('[overlay]', msg);
      setOverlay({ url: null, bounds, loading: false, error: msg, sceneKey });
    }
  };

  // Fechar painel e limpar overlay ao trocar talhão
  useEffect(() => {
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setPlanetLayer({ sceneId: null, enabled: false });
    setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
    setShowScenesPanel(false);
  }, [activeFieldId]);

  useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

  // ── Busca geográfica ──────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError(null);
    setTempMarker(null);

    const decimal = parseDecimalCoords(q);
    if (decimal) { setFlyTarget({ ...decimal, zoom: 15 }); setTempMarker(decimal); return; }

    const dms = parseDMSCoords(q);
    if (dms) { setFlyTarget({ ...dms, zoom: 15 }); setTempMarker(dms); return; }

    setSearchLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`, { headers: { 'Accept-Language': 'pt-BR' } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (!data?.length) throw new Error('não encontrado');
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      setFlyTarget({ lat, lng, zoom: 13 });
      setTempMarker({ lat, lng });
    } catch {
      setSearchError('Local não encontrado. Tente outro nome ou coordenadas.');
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Desenho ───────────────────────────────────────────────────────────────
  const handleMapClick = useCallback((ll: { lat: number; lng: number }) => {
    if (drawMode !== 'drawing') return;
    setDrawPoints((p) => [...p, [ll.lat, ll.lng]]);
  }, [drawMode]);

  const resetForm = () => {
    setDrawPoints([]); setFieldName(''); setFieldCultura('');
    setFieldDataPlantio(''); setFieldVariedade(''); setDrawMode('none');
  };

  const finishDrawing = async () => {
    if (!activeFarmId) { alert('Selecione uma fazenda antes de desenhar.'); return; }
    if (drawPoints.length < 3) { alert('Marque pelo menos 3 pontos.'); return; }
    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.05) { alert('Área muito pequena. Mínimo 0.05 ha.'); return; }

    const name = fieldName.trim() || `Talhão ${fields.length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];
    try {
      setIsSaving(true);
      await createField(activeFarmId, { lat: centroid[0], lng: centroid[1], name, boundaries: drawPoints, cultura: fieldCultura || undefined, dataPlantio: fieldDataPlantio || undefined, variedade: fieldVariedade || undefined, areaHa });
      resetForm();
    } catch (err: unknown) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];

  const activeField = fields.find((f) => f.id === activeFieldId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ cursor: drawMode === 'drawing' ? 'crosshair' : 'default' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', background: '#080809' }} zoomControl={false}>
        <InitialCenterController />
        <ActiveFieldFlyController />
        <FlyController target={flyTarget} />

        {mapLayer === 'osm' && <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />}
        {mapLayer === 'esri' && (
          <>
            <TileLayer attribution="&copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={20} />
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={20} opacity={0.6} />
          </>
        )}

        {planetLayer.enabled && planetLayer.sceneId && (
          <TileLayer
            attribution="&copy; Planet Labs"
            crossOrigin="use-credentials"
            url={`${API_URL}/api/planet/tiles/{z}/{x}/{y}?scene_id=${planetLayer.sceneId}`}
            opacity={0.9}
            maxZoom={18}
            zIndex={390}
            eventHandlers={{
              tileerror: () => {
                planetTileErrorCountRef.current += 1;
                // Evita falso positivo com 1 tile isolado falhando.
                if (planetTileErrorCountRef.current >= 3) {
                  setOverlay((prev) => prev.error
                    ? prev
                    : { ...prev, loading: false, error: 'Camada Planet indisponível no momento. Tente outra cena ou use Sentinel/Esri.' });
                }
              },
              tileload: () => {
                planetTileErrorCountRef.current = 0;
                setOverlay((prev) => prev.error && prev.sceneKey?.includes('|planet|')
                  ? { ...prev, error: null }
                  : prev);
              },
            }}
          />
        )}

        {/* Overlay da cena selecionada */}
        {overlay.url && overlay.bounds && (
          <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.9} zIndex={400} />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {tempMarker && <Marker position={[tempMarker.lat, tempMarker.lng]}><Popup>📍 {searchQuery}</Popup></Marker>}
        {currentLocation && locationStatus === 'precise' && !fields.some((s) => s.lat === currentLocation.lat) && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}><Popup>📍 Sua localização</Popup></Marker>
        )}

        {fields.map((loc, idx) => {
          const color = FIELD_COLORS[idx % FIELD_COLORS.length];
          const isActive = loc.id === activeFieldId;
          return (
            <Polygon
              key={loc.id}
              positions={loc.boundaries ?? [[loc.lat - 0.001, loc.lng - 0.001], [loc.lat - 0.001, loc.lng + 0.001], [loc.lat + 0.001, loc.lng + 0.001], [loc.lat + 0.001, loc.lng - 0.001]]}
              pathOptions={{ color, fillColor: color, fillOpacity: isActive ? 0.08 : 0.2, weight: isActive ? 3 : 2, dashArray: isActive ? undefined : '4 2' }}
              eventHandlers={{ click: () => { if (loc.id) setActiveField(loc.id); } }}
            >
              <Tooltip permanent direction="center" className="leaflet-field-label" offset={[0, 0]}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  {loc.name}
                </span>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 190 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.cultura && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🌱 {loc.cultura}</p>}
                  {loc.boundaries && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>📐 {polygonAreaHa(loc.boundaries).toFixed(2)} ha</p>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { if (loc.id) { setActiveField(loc.id); setShowScenesPanel(true); } }}
                      style={{ fontSize: 11, color: '#ec5b13', background: 'rgba(236,91,19,0.1)', border: '1px solid rgba(236,91,19,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                    >🛰 Ver Imagens</button>
                    <button
                      onClick={() => { if (loc.id && activeFarmId && window.confirm(`Remover "${loc.name}"?`)) removeField(activeFarmId, loc.id); }}
                      style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >🗑 Remover</button>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {drawMode === 'drawing' && drawPoints.length > 0 && (
          <>
            {drawPoints.length > 1 && <Polyline positions={[...drawPoints, drawPoints[0]]} pathOptions={{ color: '#ec5b13', weight: 2, dashArray: '6 4', opacity: 0.85 }} />}
            {drawPoints.map((pt, i) => (
              <Marker key={i} position={pt} icon={L.divIcon({ className: '', html: '<div style="width:10px;height:10px;background:#ec5b13;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>', iconAnchor: [5, 5] })} />
            ))}
          </>
        )}

        <ZoomControls />
      </MapContainer>

      {/* CSS tooltip transparente */}
      <style>{`
        .leaflet-field-label { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-field-label::before { display: none !important; }
      `}</style>

      {/* Painel de cenas Sentinel */}
      {showScenesPanel && activeFieldId && activeField && (
        <ScenesPanel
          fieldId={activeFieldId}
          fieldName={activeField.name || 'Talhão'}
          scenes={scenes}
          activeSceneKey={overlay.sceneKey}
          overlayLoading={overlay.loading}
          onClose={() => setShowScenesPanel(false)}
          onSelectScene={handleSelectScene}
        />
      )}

      {/* Badge de loading/erro do overlay */}
      {(overlay.loading || overlay.error) && (
        <div className="absolute z-[500] pointer-events-none" style={{ top: 52, left: 4 }}>
          {overlay.loading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: 'rgba(8,8,9,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(236,91,19,0.3)' }}>
              <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
              Carregando imagem...
            </div>
          )}
          {!overlay.loading && overlay.error && (
            <div className="px-3 py-2.5 rounded-xl text-[10px] font-medium flex flex-col gap-1" style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', maxWidth: 320 }}>
              <span className="font-bold flex items-center gap-1.5">
                <span>⚠</span>
                <span>Imagem satelital indisponível</span>
              </span>
              <span style={{ color: '#94a3b8' }}>{overlay.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Badge de overlay ativo */}
      {(overlay.url || (planetLayer.enabled && planetLayer.sceneId)) && !overlay.loading && overlay.sceneKey && (
        <div className="absolute z-[500] pointer-events-none" style={{ top: 52, left: 4 }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold" style={{ background: 'rgba(8,8,9,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}>
            🛰 {overlay.sceneKey?.includes('|s1|') ? 'Sentinel-1 · Radar SAR' : overlay.sceneKey?.includes('|planet|') ? 'Planet · Cena PlanetScope (≈3m)' : 'Sentinel-2 · True Color'} · Cache 30min
          </div>
        </div>
      )}

      {/* Barra de busca */}
      {drawMode === 'none' && (
        <form onSubmit={handleSearch} className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 pointer-events-auto" style={{ minWidth: 300 }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={{ background: 'rgba(8,8,9,0.88)', backdropFilter: 'blur(16px)', border: `1px solid ${searchError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#64748b', fontSize: 18 }}>search</span>
            <input className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-slate-600 focus:outline-none" placeholder="Buscar cidade ou coordenadas..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null); }} />
            {searchLoading && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />}
          </div>
          <button type="submit" disabled={searchLoading || !searchQuery.trim()} className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: '#ec5b13', flexShrink: 0 }}>Ir</button>
        </form>
      )}

      {searchError && drawMode === 'none' && (
        <div className="absolute z-[500] text-[10px] font-semibold px-3 py-1.5 rounded-lg pointer-events-none" style={{ top: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {searchError}
        </div>
      )}

      {/* Seletor de camadas */}
      {drawMode === 'none' && (
        <div className="absolute top-4 left-4 z-[500] flex gap-1.5 pointer-events-auto">
          {([{ key: 'osm', label: 'OpenStreetMap' }, { key: 'esri', label: 'Satélite HD' }] as { key: MapLayer; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setMapLayer(key)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              style={{ background: mapLayer === key ? 'rgba(236,91,19,0.9)' : 'rgba(8,8,9,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: mapLayer === key ? '#fff' : '#94a3b8' }}>
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={!planetLayer.sceneId}
            onClick={() => setPlanetLayer((prev) => ({ ...prev, enabled: prev.sceneId ? !prev.enabled : false }))}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
            style={{
              background: planetLayer.enabled ? 'rgba(52,211,153,0.18)' : 'rgba(8,8,9,0.82)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${planetLayer.enabled ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: planetLayer.enabled ? '#34d399' : '#94a3b8',
            }}
            title={planetLayer.sceneId ? 'Alternar camada Planet' : 'Selecione uma cena Planet para habilitar a camada'}
          >
            Planet
          </button>
        </div>
      )}

      {/* Botão Desenhar */}
      {drawMode === 'none' && (
        <button onClick={() => setDrawMode('drawing')} className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 pointer-events-auto" style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}>
          <span className="material-symbols-outlined text-base">add_location_alt</span>
          Desenhar Talhão
        </button>
      )}

      {/* Controles de desenho */}
      {drawMode === 'drawing' && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white pointer-events-none" style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,91,19,0.3)' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>draw</span>
            Clique para marcar vértices · {drawPoints.length} ponto{drawPoints.length !== 1 ? 's' : ''}
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto" style={{ background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 420 }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>{drawPoints.length} pontos · Novo Talhão</p>
            <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40" placeholder="Nome do talhão" value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40" placeholder="Cultura (ex: Soja)" value={fieldCultura} onChange={(e) => setFieldCultura(e.target.value)} />
              <input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40" placeholder="Variedade" value={fieldVariedade} onChange={(e) => setFieldVariedade(e.target.value)} />
            </div>
            <input type="date" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-orange-500/40" value={fieldDataPlantio} onChange={(e) => setFieldDataPlantio(e.target.value)} />
            {drawPoints.length >= 3 && <p className="text-[10px] text-slate-400 text-center">Área: <span className="font-bold text-white">{polygonAreaHa(drawPoints).toFixed(2)} ha</span></p>}
            <div className="flex gap-2">
              <button onClick={finishDrawing} disabled={isSaving || drawPoints.length < 3} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: '#ec5b13' }}>{isSaving ? 'Salvando...' : 'Salvar Talhão'}</button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>Cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
