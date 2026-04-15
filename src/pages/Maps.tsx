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

// Cada tipo de mapa define qual satélite usa e qual parâmetro de banda envia
interface MapType {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  // Satélite fonte principal
  source: 's2' | 's1' | 'planet' | 'dem';
  // Parâmetro enviado ao backend para o tipo de visualização
  band: string;
  legend: { color: string; label: string }[];
  resolution: string;
  updateFreq: string;
  sourceLabel: string;
}

const MAP_TYPES: MapType[] = [
  {
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Índice de Vegetação por Diferença Normalizada',
    description: 'Mede saúde e densidade da vegetação. Calculado a partir das bandas NIR e Red do Sentinel-2. Valores altos = vegetação vigorosa.',
    icon: 'grass',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    source: 's2',
    band: 'NDVI',
    legend: [
      { color: '#d73027', label: '< 0.1 — Sem vegetação' },
      { color: '#fc8d59', label: '0.1–0.3 — Esparsa' },
      { color: '#fee08b', label: '0.3–0.5 — Moderada' },
      { color: '#d9ef8b', label: '0.5–0.7 — Boa' },
      { color: '#1a9850', label: '> 0.7 — Densa / saudável' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
    sourceLabel: 'Sentinel-2 (ESA)',
  },
  {
    id: 'ndre',
    name: 'NDRE',
    fullName: 'Índice de Vegetação Red-Edge',
    description: 'Detecta estresse precoce e teor de clorofila. Usa bandas NIR e Red-Edge do Sentinel-2. Mais sensível em dossel denso que o NDVI.',
    icon: 'biotech',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    source: 's2',
    band: 'NDRE',
    legend: [
      { color: '#9b2226', label: '< 0.1 — Estresse severo' },
      { color: '#e9d8a6', label: '0.1–0.25 — Estresse leve' },
      { color: '#94d2bd', label: '0.25–0.4 — Normal' },
      { color: '#0a9396', label: '0.4–0.55 — Saudável' },
      { color: '#005f73', label: '> 0.55 — Muito saudável' },
    ],
    resolution: '20 m/pixel',
    updateFreq: 'A cada 5 dias',
    sourceLabel: 'Sentinel-2 (ESA)',
  },
  {
    id: 'evi',
    name: 'EVI',
    fullName: 'Índice de Vegetação Melhorado',
    description: 'Aprimora o NDVI reduzindo influência do solo e atmosfera. Usa bandas Blue, Red e NIR do Sentinel-2. Mais robusto em vegetação densa.',
    icon: 'eco',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    source: 's2',
    band: 'EVI',
    legend: [
      { color: '#dc2626', label: '< 0.2 — Baixo' },
      { color: '#facc15', label: '0.2–0.4 — Médio' },
      { color: '#4ade80', label: '0.4–0.6 — Alto' },
      { color: '#166534', label: '> 0.6 — Muito alto' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
    sourceLabel: 'Sentinel-2 (ESA)',
  },
  {
    id: 'rgb',
    name: 'Cor Real',
    fullName: 'Composição RGB — Cor Real Sentinel-2',
    description: 'Composição de bandas Red, Green, Blue do Sentinel-2. Imagem de cor real de alta resolução para inspeção visual detalhada da lavoura.',
    icon: 'image',
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.12)',
    source: 's2',
    band: 'RGB',
    legend: [
      { color: '#166534', label: 'Vegetação' },
      { color: '#92400e', label: 'Solo exposto' },
      { color: '#1d4ed8', label: 'Água' },
      { color: '#9ca3af', label: 'Urbano / infraestrutura' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
    sourceLabel: 'Sentinel-2 (ESA)',
  },
  {
    id: 'sar',
    name: 'SAR / Radar',
    fullName: 'Radar de Abertura Sintética — Sentinel-1',
    description: 'Penetra nuvens e chuva. Monitora a lavoura independente do clima. Detecta biomassa, estrutura do dossel e umidade do solo pelo radar.',
    icon: 'radar',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.12)',
    source: 's1',
    band: 'SAR',
    legend: [
      { color: '#1e293b', label: 'Baixa retrodispersão (água/liso)' },
      { color: '#475569', label: 'Média retrodispersão (solo)' },
      { color: '#e2e8f0', label: 'Alta retrodispersão (vegetação)' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
    sourceLabel: 'Sentinel-1 (ESA)',
  },
  {
    id: 'moisture',
    name: 'Umidade',
    fullName: 'Índice de Umidade da Vegetação (NDMI)',
    description: 'Estima conteúdo de água na vegetação usando bandas NIR e SWIR do Sentinel-2. Auxilia no manejo de irrigação e detecção de estresse hídrico.',
    icon: 'water_drop',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.12)',
    source: 's2',
    band: 'NDMI',
    legend: [
      { color: '#ea580c', label: 'Seco — estresse hídrico' },
      { color: '#fde68a', label: 'Moderado' },
      { color: '#67e8f9', label: 'Normal' },
      { color: '#0284c7', label: 'Úmido' },
    ],
    resolution: '20 m/pixel',
    updateFreq: 'A cada 5 dias',
    sourceLabel: 'Sentinel-2 (ESA)',
  },
  {
    id: 'planet_rgb',
    name: 'Planet HD',
    fullName: 'PlanetScope — Alta Resolução (≈3 m)',
    description: 'Imagem de altíssima resolução do Planet Labs. Constelação de satélites com revisita diária. Resolução ≈3m ideal para inspeção de cultura.',
    icon: 'public',
    color: '#34d399',
    bgColor: 'rgba(52,211,153,0.12)',
    source: 'planet',
    band: 'RGB',
    legend: [
      { color: '#166534', label: 'Vegetação' },
      { color: '#92400e', label: 'Solo exposto' },
      { color: '#1d4ed8', label: 'Água' },
    ],
    resolution: '≈3 m/pixel',
    updateFreq: 'Diária (constelação)',
    sourceLabel: 'Planet Labs',
  },
  {
    id: 'heat',
    name: 'Calor / Zonas',
    fullName: 'Variabilidade de Produtividade — Zonas de Manejo',
    description: 'Análise multitemporal de NDVI para identificar zonas de manejo. Base para agricultura de precisão e receitas de aplicação variável.',
    icon: 'thermostat',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    source: 's2',
    band: 'HEAT',
    legend: [
      { color: '#1e40af', label: 'Zona baixa produtividade' },
      { color: '#16a34a', label: 'Zona média produtividade' },
      { color: '#dc2626', label: 'Zona alta produtividade' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'Por safra',
    sourceLabel: 'Sentinel-2 multitemporal',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function buildAuthHeaders(): Promise<HeadersInit> {
  const { supabase } = await import('../services/supabase');
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const r = await supabase.auth.refreshSession();
    session = r.data.session;
  }
  if (!session?.access_token) throw new Error('Sessão expirada.');
  return { Authorization: `Bearer ${session.access_token}` };
}

function computeBounds(boundaries: [number, number][]): L.LatLngBoundsExpression {
  const lats = boundaries.map((p) => p[0]);
  const lngs = boundaries.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

// ── FlyController ─────────────────────────────────────────────────────────────
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
function SceneRow({
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

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-2.5 transition-all flex items-center gap-2.5"
      style={{
        background: isActive ? 'rgba(236,91,19,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? 'rgba(236,91,19,0.5)' : 'var(--border)'}`,
      }}
    >
      <div>
        <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text, #e2e8f0)' }}>
          {scene.date_br}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
          {isS2
            ? scene.cloud_coverage !== null
              ? `☁ ${scene.cloud_coverage.toFixed(0)}% nuvens`
              : 'Cobertura N/D'
            : isPlanet
              ? 'PlanetScope · ≈3m'
              : scene.orbit ? `Órbita ${scene.orbit}` : 'SAR · Radar'}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {isS2 && scene.cloud_coverage !== null && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
            background: cloudOk ? 'rgba(74,222,128,0.15)' : cloudMid ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
            color: cloudOk ? '#4ade80' : cloudMid ? '#fbbf24' : '#f87171',
          }}>
            {cloudOk ? 'LIMPO' : cloudMid ? 'PARCIAL' : 'NUBLADO'}
          </span>
        )}
        {isPlanet && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
            ≈3m
          </span>
        )}
        {isLoading && (
          <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
        )}
        {isActive && !isLoading && (
          <span className="material-symbols-outlined text-sm" style={{ color: 'var(--primary)' }}>check_circle</span>
        )}
      </div>
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Maps() {
  const { fields, activeFieldId, activeFarmId, farms } = useAppStore();
  const [selectedMap, setSelectedMap] = useState<MapType>(MAP_TYPES[0]);
  const [scenes, setScenes] = useState<ScenesState>({ s2: [], s1: [], planet: [], loading: false, error: null, fieldId: null });
  const [overlay, setOverlay] = useState<OverlayState>({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
  const prevUrlRef = useRef<string | null>(null);
  const loadingFieldRef = useRef<string | null>(null);
  const planetRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeField = fields.find((f) => f.id === activeFieldId) ?? fields[0] ?? null;
  const activeFarm = farms.find((f) => f.id === (activeField?.farm_id ?? activeFarmId)) ?? null;
  const fieldBoundaries = activeField?.boundaries as [number, number][] | undefined;

  const center: [number, number] = activeField ? [activeField.lat, activeField.lng] : [-15.7801, -47.9292];
  const zoom = activeField ? 14 : 5;

  // Cenas disponíveis para o tipo de mapa selecionado
  const availableScenes: SentinelScene[] =
    selectedMap.source === 's1' ? scenes.s1
    : selectedMap.source === 'planet' ? scenes.planet
    : scenes.s2;

  // ── Buscar cenas ao montar / trocar talhão ─────────────────────────────────
  useEffect(() => {
    if (!activeField?.id) return;
    const fieldId = activeField.id;
    if (scenes.fieldId === fieldId && !scenes.loading) return;
    if (loadingFieldRef.current === fieldId) return;

    loadingFieldRef.current = fieldId;
    setScenes({ s2: [], s1: [], planet: [], loading: true, error: null, fieldId });
    // Limpar overlay ao trocar talhão
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
        setScenes({
          s2: sentinelData.s2 || [],
          s1: sentinelData.s1 || [],
          planet: planetData.scenes || [],
          loading: false,
          error: null,
          fieldId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao buscar cenas.';
        setScenes({ s2: [], s1: [], planet: [], loading: false, error: msg, fieldId });
      } finally {
        if (loadingFieldRef.current === fieldId) loadingFieldRef.current = null;
      }
    };
    void fetchScenes();
  }, [activeField?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carregar overlay ao selecionar cena ───────────────────────────────────
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
        if (!resp.ok) throw new Error((await resp.json() as { detail?: string }).detail || `Erro ${resp.status}`);
        const boundsHeader = resp.headers.get('X-Scene-Bounds');
        let overlayBounds: L.LatLngBoundsExpression = bounds;
        if (boundsHeader) {
          const [s, w, n, e] = boundsHeader.split(',').map(Number);
          if (!isNaN(s)) overlayBounds = [[s, w], [n, e]];
        }
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        prevUrlRef.current = objectUrl;
        setOverlay({ url: objectUrl, bounds: overlayBounds, loading: false, error: null, sceneKey });
        // retry se ativo ativando
        if (resp.headers.get('X-Asset-Status') === 'activating') {
          planetRetryRef.current = setTimeout(() => { void handleSelectScene(scene); }, 30000);
        }
        return;
      }

      // Sentinel-1 ou Sentinel-2 — envia parâmetro band para o índice correto
      const params = new URLSearchParams({
        field_id: fieldId,
        source: scene.source,
        scene_date: scene.date,
        scene_id: scene.scene_id,
        band: selectedMap.band, // NDVI, NDRE, EVI, RGB, SAR, NDMI, HEAT…
      });
      if (typeof scene.cloud_coverage === 'number') params.set('cloud_coverage', String(scene.cloud_coverage));

      const resp = await fetch(`${API_URL}/api/sentinel/overlay?${params}`, { headers });
      if (!resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        let msg = `Erro ${resp.status}`;
        try {
          msg = ct.includes('json')
            ? ((await resp.json() as { detail?: string }).detail || msg)
            : (await resp.text()).slice(0, 200) || msg;
        } catch { /* mantém */ }
        throw new Error(msg);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      prevUrlRef.current = objectUrl;
      setOverlay({ url: objectUrl, bounds, loading: false, error: null, sceneKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar imagem.';
      setOverlay({ url: null, bounds, loading: false, error: msg, sceneKey });
    }
  }, [activeField?.id, fieldBoundaries, selectedMap.id, selectedMap.band, overlay.sceneKey, overlay.url]);

  // Limpar overlay ao trocar tipo de mapa
  function handleSelectMap(mt: MapType) {
    setSelectedMap(mt);
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
  }

  // Cleanup
  useEffect(() => () => {
    if (planetRetryRef.current) clearTimeout(planetRetryRef.current);
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden min-h-0 h-full">

      {/* ── Sidebar: tipo de mapa ── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col border-r overflow-y-auto scrollbar-thin"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
      >
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>satellite_alt</span>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>Mapas Agronômicos</h2>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {activeField
              ? <><span style={{ color: 'var(--primary)' }}>{activeField.name}</span>{activeFarm ? ` · ${activeFarm.name}` : ''}</>
              : 'Selecione um talhão'}
          </p>
        </div>

        <div className="p-2 space-y-0.5">
          <p className="px-2 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Tipo de análise
          </p>
          {MAP_TYPES.map((mt) => {
            const isActive = selectedMap.id === mt.id;
            // Contagem de cenas disponíveis para este tipo
            const count = mt.source === 's1' ? scenes.s1.length : mt.source === 'planet' ? scenes.planet.length : scenes.s2.length;
            return (
              <button
                key={mt.id}
                onClick={() => handleSelectMap(mt)}
                className="w-full text-left rounded-xl px-3 py-2.5 transition-all flex items-center gap-2.5"
                style={{
                  background: isActive ? mt.bgColor : 'transparent',
                  border: `1px solid ${isActive ? mt.color + '44' : 'transparent'}`,
                }}
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0" style={{ color: mt.color }}>
                  {mt.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold" style={{ color: isActive ? mt.color : 'var(--text, #e2e8f0)' }}>
                      {mt.name}
                    </span>
                    {scenes.fieldId && count > 0 && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--muted)' }}>
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{mt.sourceLabel}</p>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined text-sm" style={{ color: mt.color }}>chevron_right</span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Mapa ── */}
      <div className="flex-1 relative min-w-0">
        {activeField ? (
          <MapContainer
            key={activeField.id}
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <FlyToBounds boundaries={fieldBoundaries ?? null} />

            {/* Polígono do talhão */}
            {fieldBoundaries && fieldBoundaries.length > 0 && (
              <Polygon
                positions={fieldBoundaries}
                pathOptions={{
                  color: overlay.url ? selectedMap.color : 'rgba(255,255,255,0.7)',
                  fillColor: selectedMap.color,
                  fillOpacity: overlay.url ? 0 : 0.08,
                  weight: overlay.url ? 1.5 : 2,
                  dashArray: overlay.url ? undefined : '5 4',
                }}
              />
            )}

            {/* Overlay da imagem de satélite */}
            {overlay.url && overlay.bounds && (
              <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.92} />
            )}
          </MapContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>satellite_alt</span>
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>Nenhum talhão selecionado</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Acesse <strong>Mapa / Talhões</strong> e selecione um talhão.
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {overlay.loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-3 rounded-2xl px-8 py-6"
              style={{ background: 'rgba(8,8,9,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-white">Gerando mapa {selectedMap.name}…</p>
              <p className="text-[10px]" style={{ color: '#64748b' }}>{selectedMap.sourceLabel}</p>
            </div>
          </div>
        )}

        {/* Erro overlay */}
        {overlay.error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] rounded-xl px-4 py-2.5 flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>error</span>
            <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{overlay.error}</p>
            <button onClick={() => setOverlay((s) => ({ ...s, error: null }))} style={{ color: '#f87171' }}>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Badge: imagem carregada */}
        {overlay.url && !overlay.loading && (
          <div className="absolute top-3 left-3 z-[500] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ background: 'rgba(8,8,9,0.9)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: selectedMap.color }}>{selectedMap.icon}</span>
            <span className="text-[11px] font-bold text-white">{selectedMap.name}</span>
            <button
              onClick={() => { if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; } setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null }); }}
              className="ml-1 text-slate-500 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Painel direito: cenas + legenda ── */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-l overflow-hidden"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Header do tipo de mapa */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: selectedMap.bgColor }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="material-symbols-outlined text-base" style={{ color: selectedMap.color }}>{selectedMap.icon}</span>
            <span className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.name}</span>
          </div>
          <p className="text-[10px] leading-tight" style={{ color: 'var(--muted)' }}>{selectedMap.description}</p>
        </div>

        {/* Specs rápidas */}
        <div className="px-4 py-2 flex items-center gap-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Resolução</p>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.resolution}</p>
          </div>
          <div className="w-px h-6" style={{ background: 'var(--border)' }} />
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Revisita</p>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.updateFreq}</p>
          </div>
        </div>

        {/* Lista de cenas */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Imagens disponíveis
              </p>
              {scenes.loading && (
                <div className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              )}
            </div>

            {!activeField ? (
              <p className="text-[11px] py-4 text-center" style={{ color: 'var(--muted)' }}>
                Selecione um talhão para ver as imagens disponíveis.
              </p>
            ) : scenes.loading ? (
              <p className="text-[11px] py-4 text-center" style={{ color: 'var(--muted)' }}>
                Buscando imagens disponíveis…
              </p>
            ) : scenes.error ? (
              <div className="py-4 text-center">
                <span className="material-symbols-outlined text-2xl block mb-1" style={{ color: '#f87171' }}>cloud_off</span>
                <p className="text-[11px]" style={{ color: '#f87171' }}>{scenes.error}</p>
              </div>
            ) : availableScenes.length === 0 ? (
              <div className="py-4 text-center">
                <span className="material-symbols-outlined text-2xl block mb-1" style={{ color: 'var(--muted)' }}>
                  {selectedMap.source === 's1' ? 'radar' : selectedMap.source === 'planet' ? 'public_off' : 'cloud_off'}
                </span>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Nenhuma imagem nos últimos 90 dias.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {availableScenes.map((scene) => {
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
        </div>

        {/* Legenda */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
            Legenda
          </p>
          <div className="space-y-1.5">
            {selectedMap.legend.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded flex-shrink-0"
                  style={{ background: item.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
