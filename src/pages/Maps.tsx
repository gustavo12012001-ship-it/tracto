// src/pages/Maps.tsx — Hub de Mapas Agronômicos
// Cada mapa usa imagens reais de Sentinel-1, Sentinel-2 ou Planet
// O overlay é gerado pelo backend com a combinação de bandas correta

import { useState, useEffect, useRef, useCallback } from 'react';
import { ImageOverlay, MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { API_URL } from '../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────
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
  sceneKey: string | null;
}

type SatSource = 's2' | 's1' | 'planet';

interface MapType {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  // parâmetro `band` enviado ao backend
  band: string;
  // quais fontes são compatíveis com este índice
  compatibleSources: SatSource[];
  // tile base especial (topografia usa OpenTopoMap)
  specialTile?: string;
  // mapa especial sem overlay de satélite
  specialMode?: 'topo' | 'request';
  legend: { color: string; label: string }[];
  resolution: string;
  updateFreq: string;
}

const MAP_TYPES: MapType[] = [
  {
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Índice de Vegetação por Diferença Normalizada',
    description: 'Mede saúde e densidade da vegetação. Calculado a partir das bandas NIR e Red. Valores altos = vegetação vigorosa.',
    icon: 'grass',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    band: 'NDVI',
    compatibleSources: ['s2', 'planet'],
    legend: [
      { color: '#d73027', label: '< 0.1 — Sem vegetação' },
      { color: '#fc8d59', label: '0.1–0.3 — Esparsa' },
      { color: '#fee08b', label: '0.3–0.5 — Moderada' },
      { color: '#d9ef8b', label: '0.5–0.7 — Boa' },
      { color: '#1a9850', label: '> 0.7 — Densa / saudável' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'ndre',
    name: 'NDRE',
    fullName: 'Índice de Vegetação Red-Edge',
    description: 'Detecta estresse precoce e teor de clorofila. Usa bandas NIR e Red-Edge. Mais sensível em dossel denso que o NDVI.',
    icon: 'biotech',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    band: 'NDRE',
    compatibleSources: ['s2'],
    legend: [
      { color: '#9b2226', label: '< 0.1 — Estresse severo' },
      { color: '#e9d8a6', label: '0.1–0.25 — Estresse leve' },
      { color: '#94d2bd', label: '0.25–0.4 — Normal' },
      { color: '#0a9396', label: '0.4–0.55 — Saudável' },
      { color: '#005f73', label: '> 0.55 — Muito saudável' },
    ],
    resolution: '20 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'evi',
    name: 'EVI',
    fullName: 'Índice de Vegetação Melhorado',
    description: 'Aprimora o NDVI reduzindo influência do solo e atmosfera. Usa bandas Blue, Red e NIR. Mais robusto em vegetação densa.',
    icon: 'eco',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    band: 'EVI',
    compatibleSources: ['s2', 'planet'],
    legend: [
      { color: '#dc2626', label: '< 0.2 — Baixo' },
      { color: '#facc15', label: '0.2–0.4 — Médio' },
      { color: '#4ade80', label: '0.4–0.6 — Alto' },
      { color: '#166534', label: '> 0.6 — Muito alto' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'moisture',
    name: 'Umidade',
    fullName: 'Índice de Umidade da Vegetação (NDMI)',
    description: 'Estima conteúdo de água na vegetação usando bandas NIR e SWIR. Auxilia no manejo de irrigação e detecção de estresse hídrico.',
    icon: 'water_drop',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.12)',
    band: 'NDMI',
    compatibleSources: ['s2'],
    legend: [
      { color: '#ea580c', label: 'Seco — estresse hídrico' },
      { color: '#fde68a', label: 'Moderado' },
      { color: '#67e8f9', label: 'Normal' },
      { color: '#0284c7', label: 'Úmido' },
    ],
    resolution: '20 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'sar',
    name: 'SAR / Radar',
    fullName: 'Radar de Abertura Sintética — Sentinel-1',
    description: 'Penetra nuvens e chuva. Monitora a lavoura independente do clima. Detecta biomassa, estrutura do dossel e umidade do solo.',
    icon: 'radar',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.12)',
    band: 'SAR',
    compatibleSources: ['s1'],
    legend: [
      { color: '#1e293b', label: 'Baixa retrodispersão' },
      { color: '#475569', label: 'Média retrodispersão' },
      { color: '#e2e8f0', label: 'Alta retrodispersão' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
  },
  {
    id: 'rgb',
    name: 'Cor Real',
    fullName: 'Composição RGB — Cor Real',
    description: 'Composição de bandas R, G, B. Imagem de cor real de alta resolução para inspeção visual detalhada da lavoura.',
    icon: 'image',
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.12)',
    band: 'RGB',
    compatibleSources: ['s2', 'planet', 's1'],
    legend: [
      { color: '#166534', label: 'Vegetação' },
      { color: '#92400e', label: 'Solo exposto' },
      { color: '#1d4ed8', label: 'Água' },
      { color: '#9ca3af', label: 'Urbano / infraestrutura' },
    ],
    resolution: '3–10 m/pixel',
    updateFreq: 'A cada 5–6 dias',
  },
  {
    id: 'heat',
    name: 'Mapa de Calor',
    fullName: 'Variabilidade de Produtividade — Zonas de Manejo',
    description: 'Análise multitemporal de NDVI para identificar zonas de manejo. Base para agricultura de precisão e receitas de aplicação variável por insumo.',
    icon: 'thermostat',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    band: 'HEAT',
    compatibleSources: ['s2'],
    legend: [
      { color: '#1e40af', label: 'Zona baixa produtividade' },
      { color: '#16a34a', label: 'Zona média produtividade' },
      { color: '#dc2626', label: 'Zona alta produtividade' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'Por safra',
  },
  {
    id: 'topography',
    name: 'Topografia',
    fullName: 'Modelo Digital de Elevação e Declividade',
    description: 'Visualiza curvas de nível, declividade e drenagem da área. Fundamental para planejamento de plantio, irrigação e manejo de erosão.',
    icon: 'landscape',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    band: 'DEM',
    compatibleSources: [],
    specialTile: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    specialMode: 'topo',
    legend: [
      { color: '#1a5276', label: 'Baixada (< 5% declive)' },
      { color: '#2ecc71', label: 'Suave (5–10%)' },
      { color: '#f39c12', label: 'Moderado (10–20%)' },
      { color: '#e74c3c', label: 'Íngreme (> 20%)' },
    ],
    resolution: '12.5 m/pixel',
    updateFreq: 'Estático (terreno)',
  },
  {
    id: 'application',
    name: 'Aplicação',
    fullName: 'Mapa de Aplicação Prescritiva',
    description: 'Gera receitas de aplicação variável de insumos (fertilizantes, defensivos) com base em zonas de manejo. Reduz custos e aumenta eficiência.',
    icon: 'agriculture',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.12)',
    band: 'APP',
    compatibleSources: ['s2'],
    specialMode: 'request',
    legend: [
      { color: '#bfdbfe', label: 'Dose mínima (kg/ha)' },
      { color: '#3b82f6', label: 'Dose média (kg/ha)' },
      { color: '#1e3a8a', label: 'Dose máxima (kg/ha)' },
    ],
    resolution: 'Variável por talhão',
    updateFreq: 'Por demanda / safra',
  },
];

// Rótulos e ícones dos satélites
const SAT_INFO: Record<SatSource, { label: string; icon: string; color: string }> = {
  s2: { label: 'Sentinel-2', icon: 'satellite_alt', color: '#60a5fa' },
  s1: { label: 'Sentinel-1', icon: 'radar', color: '#a78bfa' },
  planet: { label: 'Planet', icon: 'public', color: '#34d399' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function buildAuthHeaders(): Promise<HeadersInit> {
  const { supabase } = await import('../services/supabase');
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) { const r = await supabase.auth.refreshSession(); session = r.data.session; }
  if (!session?.access_token) throw new Error('Sessão expirada.');
  return { Authorization: `Bearer ${session.access_token}` };
}

function computeBounds(boundaries: [number, number][]): L.LatLngBoundsExpression {
  const lats = boundaries.map((p) => p[0]);
  const lngs = boundaries.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

function FlyToBounds({ boundaries }: { boundaries: [number, number][] | null }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!boundaries || boundaries.length < 3) return;
    const key = JSON.stringify(boundaries[0]);
    if (prevRef.current === key) return;
    prevRef.current = key;
    map.flyToBounds(computeBounds(boundaries) as L.LatLngBoundsExpression, { padding: [40, 40], duration: 1 });
  }, [boundaries, map]);
  return null;
}

// ── SceneRow ──────────────────────────────────────────────────────────────────
function SceneRow({ scene, isActive, isLoading, onClick }: {
  scene: SentinelScene; isActive: boolean; isLoading: boolean; onClick: () => void;
}) {
  const isS2 = scene.source === 's2';
  const isPlanet = scene.source === 'planet';
  const cloudOk = scene.cloud_coverage !== null && scene.cloud_coverage <= 30;
  const cloudMid = scene.cloud_coverage !== null && scene.cloud_coverage > 30 && scene.cloud_coverage <= 60;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl px-3 py-2 transition-all flex items-center gap-2"
      style={{
        background: isActive ? 'rgba(236,91,19,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? 'rgba(236,91,19,0.5)' : 'var(--border)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{scene.date_br}</p>
        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
          {isS2
            ? scene.cloud_coverage !== null ? `☁ ${scene.cloud_coverage.toFixed(0)}% nuvens` : 'Cobertura N/D'
            : isPlanet ? 'PlanetScope · ≈3m'
            : scene.orbit ? `Órbita ${scene.orbit}` : 'SAR · Radar'}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isS2 && scene.cloud_coverage !== null && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
            background: cloudOk ? 'rgba(74,222,128,0.15)' : cloudMid ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
            color: cloudOk ? '#4ade80' : cloudMid ? '#fbbf24' : '#f87171',
          }}>{cloudOk ? 'LIMPO' : cloudMid ? 'PARCIAL' : 'NUBLADO'}</span>
        )}
        {isPlanet && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>≈3m</span>
        )}
        {isLoading && <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />}
        {isActive && !isLoading && <span className="material-symbols-outlined text-sm" style={{ color: 'var(--primary)' }}>check_circle</span>}
      </div>
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Maps() {
  const { fields, activeFieldId, activeFarmId, farms } = useAppStore();
  const [selectedMap, setSelectedMap] = useState<MapType>(MAP_TYPES[0]);
  // Aba de satélite selecionada no painel de cenas
  const [satTab, setSatTab] = useState<SatSource>('s2');
  const [scenes, setScenes] = useState<ScenesState>({ s2: [], s1: [], planet: [], loading: false, error: null, fieldId: null });
  const [overlay, setOverlay] = useState<OverlayState>({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
  const prevUrlRef = useRef<string | null>(null);
  const loadingFieldRef = useRef<string | null>(null);
  const planetRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeField = fields.find((f) => f.id === activeFieldId) ?? fields[0] ?? null;
  const activeFarm = farms.find((f) => f.id === (activeField?.farm_id ?? activeFarmId)) ?? null;
  const fieldBoundaries = activeField?.boundaries as [number, number][] | undefined;
  const center: [number, number] = activeField ? [activeField.lat, activeField.lng] : [-15.7801, -47.9292];

  // Cenas da aba ativa
  const tabScenes: SentinelScene[] = satTab === 's1' ? scenes.s1 : satTab === 'planet' ? scenes.planet : scenes.s2;

  // Quando o tipo de mapa muda para SAR, auto-seleciona aba S1
  function handleSelectMap(mt: MapType) {
    setSelectedMap(mt);
    if (mt.id === 'sar') setSatTab('s1');
    else if (mt.compatibleSources.length > 0 && !mt.compatibleSources.includes(satTab)) {
      setSatTab(mt.compatibleSources[0]);
    }
    // Limpar overlay
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
  }

  // ── Buscar cenas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeField?.id) return;
    const fieldId = activeField.id;
    if (scenes.fieldId === fieldId && !scenes.loading) return;
    if (loadingFieldRef.current === fieldId) return;
    loadingFieldRef.current = fieldId;
    setScenes({ s2: [], s1: [], planet: [], loading: true, error: null, fieldId });
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null });

    const fetchScenes = async () => {
      try {
        const headers = await buildAuthHeaders();
        const [sentinelResp, planetResp] = await Promise.allSettled([
          fetch(`${API_URL}/api/sentinel/scenes?field_id=${fieldId}&lookback_days=90`, { headers }),
          fetch(`${API_URL}/api/planet/scenes?field_id=${fieldId}&lookback_days=90`, { headers }),
        ]);
        const sentinelData = sentinelResp.status === 'fulfilled' && sentinelResp.value.ok
          ? await sentinelResp.value.json() as { s2: SentinelScene[]; s1: SentinelScene[] }
          : { s2: [], s1: [] };
        const planetData = planetResp.status === 'fulfilled' && planetResp.value.ok
          ? await planetResp.value.json() as { scenes: SentinelScene[] }
          : { scenes: [] };
        setScenes({ s2: sentinelData.s2 || [], s1: sentinelData.s1 || [], planet: planetData.scenes || [], loading: false, error: null, fieldId });
      } catch (err) {
        setScenes({ s2: [], s1: [], planet: [], loading: false, error: err instanceof Error ? err.message : 'Erro ao buscar cenas.', fieldId });
      } finally {
        if (loadingFieldRef.current === fieldId) loadingFieldRef.current = null;
      }
    };
    void fetchScenes();
  }, [activeField?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carregar overlay ──────────────────────────────────────────────────────
  const handleSelectScene = useCallback(async (scene: SentinelScene) => {
    if (!activeField?.id || !fieldBoundaries || fieldBoundaries.length < 3) return;
    const fieldId = activeField.id;
    const sceneKey = `${fieldId}|${selectedMap.id}|${scene.scene_id}`;
    if (overlay.sceneKey === sceneKey && overlay.url) return;

    const bounds = computeBounds(fieldBoundaries);
    setOverlay({ url: null, bounds, loading: true, error: null, sceneKey });
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    if (planetRetryRef.current) { clearTimeout(planetRetryRef.current); planetRetryRef.current = null; }

    try {
      const headers = await buildAuthHeaders();
      if (scene.source === 'planet') {
        const resp = await fetch(`${API_URL}/api/planet/overlay?field_id=${fieldId}&scene_id=${scene.scene_id}`, { headers });
        if (!resp.ok) throw new Error(((await resp.json()) as { detail?: string }).detail || `Erro ${resp.status}`);
        const boundsHeader = resp.headers.get('X-Scene-Bounds');
        let overlayBounds: L.LatLngBoundsExpression = bounds;
        if (boundsHeader) { const [s, w, n, e] = boundsHeader.split(',').map(Number); if (!isNaN(s)) overlayBounds = [[s, w], [n, e]]; }
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        prevUrlRef.current = objectUrl;
        setOverlay({ url: objectUrl, bounds: overlayBounds, loading: false, error: null, sceneKey });
        if (resp.headers.get('X-Asset-Status') === 'activating') {
          planetRetryRef.current = setTimeout(() => { void handleSelectScene(scene); }, 30000);
        }
        return;
      }
      const params = new URLSearchParams({ field_id: fieldId, source: scene.source, scene_date: scene.date, scene_id: scene.scene_id, band: selectedMap.band });
      if (typeof scene.cloud_coverage === 'number') params.set('cloud_coverage', String(scene.cloud_coverage));
      const resp = await fetch(`${API_URL}/api/sentinel/overlay?${params}`, { headers });
      if (!resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        let msg = `Erro ${resp.status}`;
        try { msg = ct.includes('json') ? (((await resp.json()) as { detail?: string }).detail || msg) : (await resp.text()).slice(0, 200) || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      prevUrlRef.current = objectUrl;
      setOverlay({ url: objectUrl, bounds, loading: false, error: null, sceneKey });
    } catch (err) {
      setOverlay({ url: null, bounds, loading: false, error: err instanceof Error ? err.message : 'Erro ao carregar imagem.', sceneKey });
    }
  }, [activeField?.id, fieldBoundaries, selectedMap.id, selectedMap.band, overlay.sceneKey, overlay.url]);

  useEffect(() => () => {
    if (planetRetryRef.current) clearTimeout(planetRetryRef.current);
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
  }, []);

  // Tile base: topografia usa OpenTopoMap, resto usa satélite ESRI
  const tileUrl = selectedMap.specialTile
    ?? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden min-h-0 h-full">

      {/* ── Sidebar esquerda: tipo de mapa ── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r overflow-y-auto scrollbar-thin"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
      >
        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>satellite_alt</span>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>Mapas Agro</h2>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {activeField
              ? <><span style={{ color: 'var(--primary)' }}>{activeField.name}</span>{activeFarm ? ` · ${activeFarm.name}` : ''}</>
              : 'Selecione um talhão'}
          </p>
        </div>

        <div className="p-2 space-y-0.5">
          <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Análise
          </p>
          {MAP_TYPES.map((mt) => {
            const isActive = selectedMap.id === mt.id;
            return (
              <button
                key={mt.id}
                onClick={() => handleSelectMap(mt)}
                className="w-full text-left rounded-xl px-2.5 py-2 transition-all flex items-center gap-2"
                style={{
                  background: isActive ? mt.bgColor : 'transparent',
                  border: `1px solid ${isActive ? mt.color + '44' : 'transparent'}`,
                }}
              >
                <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: mt.color }}>{mt.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate" style={{ color: isActive ? mt.color : 'var(--text, #e2e8f0)' }}>{mt.name}</p>
                  <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{mt.fullName.split('—')[0].trim()}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Mapa ── */}
      <div className="flex-1 relative min-w-0">
        {activeField ? (
          <MapContainer key={`${activeField.id}-${selectedMap.id}`} center={center} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url={tileUrl} />
            <FlyToBounds boundaries={fieldBoundaries ?? null} />
            {fieldBoundaries && fieldBoundaries.length > 0 && (
              <Polygon
                positions={fieldBoundaries}
                pathOptions={{
                  color: overlay.url ? selectedMap.color : 'rgba(255,255,255,0.6)',
                  fillColor: selectedMap.color,
                  fillOpacity: overlay.url ? 0 : 0.07,
                  weight: 2,
                  dashArray: overlay.url ? undefined : '5 4',
                }}
              />
            )}
            {overlay.url && overlay.bounds && (
              <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.93} />
            )}
          </MapContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg)' }}>
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>satellite_alt</span>
            <p className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>Nenhum talhão selecionado</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Acesse <strong>Mapa / Talhões</strong> para selecionar.</p>
          </div>
        )}

        {/* Spinner de carregamento */}
        {overlay.loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-3 rounded-2xl px-8 py-6" style={{ background: 'rgba(8,8,9,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-white">Gerando mapa {selectedMap.name}…</p>
              <p className="text-[10px]" style={{ color: '#64748b' }}>{SAT_INFO[satTab]?.label ?? selectedMap.band}</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {overlay.error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>error</span>
            <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{overlay.error}</p>
            <button onClick={() => setOverlay((s) => ({ ...s, error: null }))} style={{ color: '#f87171' }}>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Badge mapa ativo */}
        {overlay.url && !overlay.loading && (
          <div className="absolute top-3 left-3 z-[500] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(8,8,9,0.9)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: selectedMap.color }}>{selectedMap.icon}</span>
            <span className="text-[11px] font-bold text-white">{selectedMap.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: SAT_INFO[satTab]?.color + '22', color: SAT_INFO[satTab]?.color }}>{SAT_INFO[satTab]?.label}</span>
            <button onClick={() => { if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; } setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null }); }} className="ml-1" style={{ color: '#64748b' }}>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Painel direito: satélites + cenas + legenda ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-l overflow-hidden" style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>

        {/* Header do tipo de mapa */}
        <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: selectedMap.bgColor }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="material-symbols-outlined text-base" style={{ color: selectedMap.color }}>{selectedMap.icon}</span>
            <span className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.name}</span>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded ml-auto" style={{ background: selectedMap.color + '33', color: selectedMap.color }}>{selectedMap.band}</span>
          </div>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--muted)' }}>{selectedMap.description}</p>
        </div>

        {/* Specs */}
        <div className="px-3 py-2 flex items-center gap-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Resolução</p>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.resolution}</p>
          </div>
          <div className="w-px h-5" style={{ background: 'var(--border)' }} />
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Revisita</p>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.updateFreq}</p>
          </div>
        </div>

        {/* Tabs S1 / S2 / Planet — sempre visíveis */}
        {selectedMap.specialMode !== 'topo' && (
          <div className="flex gap-1 p-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            {(['s2', 's1', 'planet'] as SatSource[]).map((src) => {
              const info = SAT_INFO[src];
              const isCompatible = selectedMap.compatibleSources.includes(src) || selectedMap.compatibleSources.length === 0;
              const isActive = satTab === src;
              const count = src === 's1' ? scenes.s1.length : src === 'planet' ? scenes.planet.length : scenes.s2.length;
              return (
                <button
                  key={src}
                  onClick={() => setSatTab(src)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all"
                  style={{
                    background: isActive ? info.color + '18' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? info.color + '44' : 'var(--border)'}`,
                    opacity: !isCompatible ? 0.45 : 1,
                  }}
                  title={!isCompatible ? `${info.label} não é compatível com ${selectedMap.name}` : info.label}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: isActive ? info.color : 'var(--muted)' }}>{info.icon}</span>
                  <span className="text-[9px] font-bold" style={{ color: isActive ? info.color : 'var(--muted)' }}>
                    {src === 's2' ? 'S-2' : src === 's1' ? 'S-1' : 'Planet'}
                  </span>
                  {scenes.fieldId && count > 0 && (
                    <span className="text-[8px]" style={{ color: 'var(--muted)' }}>{count} imgs</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Aviso de incompatibilidade */}
        {selectedMap.compatibleSources.length > 0 && !selectedMap.compatibleSources.includes(satTab) && selectedMap.specialMode !== 'topo' && (
          <div className="mx-2 mt-2 px-3 py-2 rounded-xl flex items-start gap-2 flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: '#fbbf24' }}>warning</span>
            <p className="text-[10px] leading-snug" style={{ color: '#fbbf24' }}>
              {selectedMap.name} usa {selectedMap.compatibleSources.map(s => SAT_INFO[s].label).join(' / ')} para calcular este índice.
            </p>
          </div>
        )}

        {/* Conteúdo da aba: cenas OU modo especial */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {selectedMap.specialMode === 'topo' ? (
            <div className="p-4 text-center flex flex-col items-center gap-3 pt-6">
              <span className="material-symbols-outlined text-4xl" style={{ color: selectedMap.color }}>landscape</span>
              <p className="text-xs font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>Mapa Topográfico Ativo</p>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                Visualizando curvas de nível via OpenTopoMap. Dados de elevação SRTM/ALOS — resolução 12.5 m.
              </p>
            </div>
          ) : selectedMap.specialMode === 'request' ? (
            <div className="p-4 flex flex-col gap-3 pt-4">
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                O mapa de aplicação prescritiva é gerado com base na análise de zonas de manejo do talhão ativo.
              </p>
              {activeField && (
                <button className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2" style={{ background: selectedMap.color, color: '#fff' }}>
                  <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                  Solicitar análise
                </button>
              )}
              <p className="text-[10px] text-center" style={{ color: 'var(--muted)' }}>
                A análise será gerada pela IA e enviada por notificação.
              </p>
            </div>
          ) : (
            <div className="p-2">
              <p className="px-1 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Imagens disponíveis
              </p>
              {!activeField ? (
                <p className="text-[11px] py-4 text-center" style={{ color: 'var(--muted)' }}>Selecione um talhão.</p>
              ) : scenes.loading ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Buscando…</p>
                </div>
              ) : scenes.error ? (
                <div className="py-4 text-center">
                  <span className="material-symbols-outlined text-2xl block mb-1" style={{ color: '#f87171' }}>cloud_off</span>
                  <p className="text-[11px]" style={{ color: '#f87171' }}>{scenes.error}</p>
                </div>
              ) : tabScenes.length === 0 ? (
                <div className="py-4 text-center">
                  <span className="material-symbols-outlined text-2xl block mb-1" style={{ color: 'var(--muted)' }}>
                    {satTab === 's1' ? 'radar' : satTab === 'planet' ? 'public_off' : 'cloud_off'}
                  </span>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Nenhuma imagem nos últimos 90 dias.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tabScenes.map((scene) => {
                    const key = `${activeField?.id}|${selectedMap.id}|${scene.scene_id}`;
                    return (
                      <SceneRow
                        key={scene.scene_id}
                        scene={scene}
                        isActive={overlay.sceneKey === key}
                        isLoading={overlay.loading && overlay.sceneKey === key}
                        onClick={() => void handleSelectScene(scene)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legenda */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Legenda</p>
          <div className="space-y-1.5">
            {selectedMap.legend.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: item.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
