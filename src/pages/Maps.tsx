// src/pages/Maps.tsx — Hub de Mapas Agronômicos
// Cada mapa usa imagens reais de Sentinel-1, Sentinel-2 ou Planet
// backendReady = false → mostra estado de "processamento em desenvolvimento"

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
  howItWorks: string;       // Explicação técnica de como o índice é calculado
  icon: string;
  color: string;
  bgColor: string;
  band: string;
  compatibleSources: SatSource[];
  // true = overlay funcional agora; false = backend ainda não processa este índice
  backendReady: boolean;
  specialTile?: string;
  specialMode?: 'topo' | 'request';
  legend: { color: string; label: string }[];
  resolution: string;
  updateFreq: string;
}

const MAP_TYPES: MapType[] = [
  {
    id: 'rgb',
    name: 'Cor Real',
    fullName: 'Composição RGB — Cor Real',
    description: 'Imagem de cor real do satélite. Bandas R, G, B combinadas para visualização natural da lavoura.',
    howItWorks: 'O satélite captura as bandas Red (B04), Green (B03) e Blue (B02) do Sentinel-2. Combinadas em RGB, resultam na imagem de cor natural — o que você veria de um avião.',
    icon: 'image',
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.12)',
    band: 'RGB',
    compatibleSources: ['s2', 'planet', 's1'],
    backendReady: true,
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
    id: 'sar',
    name: 'SAR / Radar',
    fullName: 'Radar de Abertura Sintética — Sentinel-1',
    description: 'Penetra nuvens e chuva. Monitora a lavoura com radar independente do clima.',
    howItWorks: 'O Sentinel-1 emite pulsos de micro-ondas (banda C, 5.6 cm) e mede o sinal refletido (retrodispersão). Funciona de noite e através de nuvens. Polarizações VV e VH revelam biomassa, umidade do solo e estrutura do dossel.',
    icon: 'radar',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.12)',
    band: 'SAR',
    compatibleSources: ['s1'],
    backendReady: true,
    legend: [
      { color: '#1e293b', label: 'Baixa retrodispersão (água)' },
      { color: '#475569', label: 'Média (solo)' },
      { color: '#e2e8f0', label: 'Alta (vegetação densa)' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
  },
  {
    id: 'topography',
    name: 'Topografia',
    fullName: 'Modelo Digital de Elevação e Declividade',
    description: 'Curvas de nível, declividade e drenagem. Fundamental para planejamento de irrigação e erosão.',
    howItWorks: 'Utiliza dados SRTM (Shuttle Radar Topography Mission) da NASA e ALOS AW3D30 para gerar um Modelo Digital de Elevação (MDE). Visualizado via OpenTopoMap com curvas de nível, cores hipsométricas e sombreamento de relevo.',
    icon: 'landscape',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    band: 'DEM',
    compatibleSources: [],
    backendReady: true,
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
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Índice de Vegetação por Diferença Normalizada',
    description: 'Mede saúde e densidade da vegetação. O índice mais utilizado na agricultura de precisão.',
    howItWorks: 'NDVI = (NIR − Red) / (NIR + Red). Usa as bandas B08 (NIR) e B04 (Red) do Sentinel-2. Valores próximos de 1 indicam vegetação densa e saudável; próximos de 0 indicam solo ou estresse severo. Requer que o backend aplique o evalscript de NDVI e renderize com paleta de cores.',
    icon: 'grass',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    band: 'NDVI',
    compatibleSources: ['s2', 'planet'],
    backendReady: true,
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
    description: 'Detecta estresse precoce e teor de clorofila. Mais preciso que NDVI em dossel denso.',
    howItWorks: 'NDRE = (B08A − B05) / (B08A + B05). Usa a banda Red-Edge (B05, 705 nm) que é altamente sensível ao teor de clorofila. Detecta deficiência de nitrogênio antes de ser visível a olho nu. Exclusivo do Sentinel-2.',
    icon: 'biotech',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    band: 'NDRE',
    compatibleSources: ['s2'],
    backendReady: true,
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
    description: 'Aprimora o NDVI reduzindo influência do solo e atmosfera. Mais robusto em vegetação densa.',
    howItWorks: 'EVI = 2.5 × (NIR − Red) / (NIR + 6×Red − 7.5×Blue + 1). Usa bandas B08, B04 e B02. Corrige efeitos de aerossóis e satura menos que o NDVI em áreas de alta biomassa. Desenvolvido pela NASA/MODIS.',
    icon: 'eco',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    band: 'EVI',
    compatibleSources: ['s2', 'planet'],
    backendReady: true,
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
    description: 'Estima conteúdo de água na vegetação. Auxilia no manejo de irrigação.',
    howItWorks: 'NDMI = (B08 − B11) / (B08 + B11). Usa a banda SWIR (B11, 1610 nm) que é absorvida pela água nas folhas. Valores negativos indicam estresse hídrico severo; positivos indicam vegetação bem hidratada.',
    icon: 'water_drop',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.12)',
    band: 'NDMI',
    compatibleSources: ['s2'],
    backendReady: true,
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
    id: 'heat',
    name: 'Mapa de Calor',
    fullName: 'Variabilidade de Produtividade — Zonas de Manejo',
    description: 'Identifica zonas de produtividade por análise multitemporal de NDVI ao longo da safra.',
    howItWorks: 'Agrupa pixels por variabilidade de NDVI em múltiplas datas da safra. Pixels consistentemente acima da média = zona alta; consistentemente abaixo = zona baixa. Requer histórico de pelo menos 5–10 imagens sem nuvem para gerar zonas confiáveis.',
    icon: 'thermostat',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    band: 'HEAT',
    compatibleSources: ['s2'],
    backendReady: false,
    legend: [
      { color: '#1e40af', label: 'Zona baixa produtividade' },
      { color: '#16a34a', label: 'Zona média produtividade' },
      { color: '#dc2626', label: 'Zona alta produtividade' },
    ],
    resolution: '10 m/pixel',
    updateFreq: 'Por safra',
  },
  {
    id: 'application',
    name: 'Aplicação',
    fullName: 'Mapa de Aplicação Prescritiva',
    description: 'Receitas de aplicação variável de insumos baseadas em zonas de manejo. Gerado pela IA.',
    howItWorks: 'A IA analisa as zonas de manejo (derivadas do Mapa de Calor) e aplica modelos agronômicos para calcular a dose ideal de fertilizante ou defensivo por zona. O resultado é exportado em formato shapefile/shapefile para uso em controladores de taxa variável.',
    icon: 'agriculture',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.12)',
    band: 'APP',
    compatibleSources: ['s2'],
    backendReady: false,
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

function computeBounds(b: [number, number][]): L.LatLngBoundsExpression {
  const lats = b.map((p) => p[0]), lngs = b.map((p) => p[1]);
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

function SceneRow({ scene, isActive, isLoading, onClick }: {
  scene: SentinelScene; isActive: boolean; isLoading: boolean; onClick: () => void;
}) {
  const isS2 = scene.source === 's2';
  const isPlanet = scene.source === 'planet';
  const cloudOk = scene.cloud_coverage !== null && scene.cloud_coverage <= 30;
  const cloudMid = scene.cloud_coverage !== null && scene.cloud_coverage > 30 && scene.cloud_coverage <= 60;
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl px-3 py-2 transition-all flex items-center gap-2"
      style={{ background: isActive ? 'rgba(236,91,19,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(236,91,19,0.5)' : 'var(--border)'}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{scene.date_br}</p>
        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
          {isS2 ? (scene.cloud_coverage !== null ? `☁ ${scene.cloud_coverage.toFixed(0)}% nuvens` : 'N/D')
            : isPlanet ? 'PlanetScope · ≈3m' : scene.orbit ? `Órbita ${scene.orbit}` : 'SAR · Radar'}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isS2 && scene.cloud_coverage !== null && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
            background: cloudOk ? 'rgba(74,222,128,0.15)' : cloudMid ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
            color: cloudOk ? '#4ade80' : cloudMid ? '#fbbf24' : '#f87171',
          }}>{cloudOk ? 'LIMPO' : cloudMid ? 'PARCIAL' : 'NUBLADO'}</span>
        )}
        {isPlanet && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>≈3m</span>}
        {isLoading && <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />}
        {isActive && !isLoading && <span className="material-symbols-outlined text-sm" style={{ color: 'var(--primary)' }}>check_circle</span>}
      </div>
    </button>
  );
}

// ── Painel "índice em desenvolvimento" ────────────────────────────────────────
function IndexPendingPanel({ mt, activeFieldName, onViewRaw }: {
  mt: MapType; activeFieldName: string | null; onViewRaw: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="flex flex-col h-full">
      {/* Banner de status */}
      <div className="mx-3 mt-3 rounded-xl p-3 flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-base" style={{ color: '#fbbf24' }}>engineering</span>
          <p className="text-xs font-bold" style={{ color: '#fbbf24' }}>Processamento em desenvolvimento</p>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: '#fcd34d' }}>
          O cálculo de <strong>{mt.name}</strong> requer que o backend processe as bandas do satélite e gere a imagem colorida com a paleta correta.
        </p>
      </div>

      {/* O que é este índice */}
      <div className="mx-3 mt-3 flex-shrink-0">
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>Como funciona o {mt.name}?</span>
          <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>
            {showDetails ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {showDetails && (
          <div className="mt-2 px-3 py-2.5 rounded-xl text-[11px] leading-relaxed" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            {mt.howItWorks}
          </div>
        )}
      </div>

      {/* O que precisa acontecer no backend */}
      <div className="mx-3 mt-3 flex-shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          O que o backend precisa fazer:
        </p>
        <div className="space-y-2">
          {[
            { icon: 'download', text: `Baixar bandas ${mt.band === 'NDVI' ? 'B08 + B04' : mt.band === 'NDRE' ? 'B08A + B05' : mt.band === 'EVI' ? 'B08 + B04 + B02' : mt.band === 'NDMI' ? 'B08 + B11' : mt.band === 'HEAT' ? 'B08 + B04 (multi-data)' : 'específicas'} do Sentinel Hub` },
            { icon: 'calculate', text: `Calcular pixel a pixel: ${mt.band === 'NDVI' ? '(NIR−Red)/(NIR+Red)' : mt.band === 'NDRE' ? '(B08A−B05)/(B08A+B05)' : mt.band === 'EVI' ? '2.5×(NIR−R)/(NIR+6R−7.5B+1)' : mt.band === 'NDMI' ? '(B08−B11)/(B08+B11)' : 'fórmula do índice'}` },
            { icon: 'palette', text: `Aplicar paleta de cores (ex: RdYlGn) e retornar PNG` },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }}>{step.icon}</span>
              <p className="text-[10px] leading-snug" style={{ color: 'var(--muted)' }}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Botão: ver imagem bruta do satélite */}
      {activeFieldName && (
        <div className="mx-3 mt-4 space-y-2 flex-shrink-0">
          <button
            onClick={onViewRaw}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text, #e2e8f0)' }}
          >
            <span className="material-symbols-outlined text-sm">image</span>
            Ver imagem bruta do satélite
          </button>
          <p className="text-[9px] text-center" style={{ color: 'var(--muted)' }}>
            Mostra a imagem RGB sem processamento de índice
          </p>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Maps() {
  const { fields, activeFieldId, activeFarmId, farms } = useAppStore();
  const [selectedMap, setSelectedMap] = useState<MapType>(MAP_TYPES[0]);
  const [satTab, setSatTab] = useState<SatSource>('s2');
  const [scenes, setScenes] = useState<ScenesState>({ s2: [], s1: [], planet: [], loading: false, error: null, fieldId: null });
  const [overlay, setOverlay] = useState<OverlayState>({ url: null, bounds: null, loading: false, error: null, sceneKey: null });
  // Modo "raw": para mapas sem backend ready, permite ver a imagem RGB bruta
  const [rawMode, setRawMode] = useState(false);
  const prevUrlRef = useRef<string | null>(null);
  const loadingFieldRef = useRef<string | null>(null);
  const planetRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeField = fields.find((f) => f.id === activeFieldId) ?? fields[0] ?? null;
  const activeFarm = farms.find((f) => f.id === (activeField?.farm_id ?? activeFarmId)) ?? null;
  const fieldBoundaries = activeField?.boundaries as [number, number][] | undefined;
  const center: [number, number] = activeField ? [activeField.lat, activeField.lng] : [-15.7801, -47.9292];

  const tabScenes: SentinelScene[] = satTab === 's1' ? scenes.s1 : satTab === 'planet' ? scenes.planet : scenes.s2;

  function handleSelectMap(mt: MapType) {
    setSelectedMap(mt);
    setRawMode(false);
    if (mt.id === 'sar') setSatTab('s1');
    else if (mt.compatibleSources.length > 0 && !mt.compatibleSources.includes(satTab)) setSatTab(mt.compatibleSources[0]);
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
        const [sResp, pResp] = await Promise.allSettled([
          fetch(`${API_URL}/api/sentinel/scenes?field_id=${fieldId}&lookback_days=90`, { headers }),
          fetch(`${API_URL}/api/planet/scenes?field_id=${fieldId}&lookback_days=90`, { headers }),
        ]);
        const sd = sResp.status === 'fulfilled' && sResp.value.ok ? await sResp.value.json() as { s2: SentinelScene[]; s1: SentinelScene[] } : { s2: [], s1: [] };
        const pd = pResp.status === 'fulfilled' && pResp.value.ok ? await pResp.value.json() as { scenes: SentinelScene[] } : { scenes: [] };
        setScenes({ s2: sd.s2 || [], s1: sd.s1 || [], planet: pd.scenes || [], loading: false, error: null, fieldId });
      } catch (err) {
        setScenes({ s2: [], s1: [], planet: [], loading: false, error: err instanceof Error ? err.message : 'Erro', fieldId });
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
    // No modo raw, sempre usa banda RGB; caso contrário, usa a banda do mapa
    const band = rawMode || !selectedMap.backendReady ? 'RGB' : selectedMap.band;
    const sceneKey = `${fieldId}|${band}|${scene.scene_id}`;
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
        let ob: L.LatLngBoundsExpression = bounds;
        if (boundsHeader) { const [s, w, n, e] = boundsHeader.split(',').map(Number); if (!isNaN(s)) ob = [[s, w], [n, e]]; }
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        prevUrlRef.current = objectUrl;
        setOverlay({ url: objectUrl, bounds: ob, loading: false, error: null, sceneKey });
        if (resp.headers.get('X-Asset-Status') === 'activating') {
          planetRetryRef.current = setTimeout(() => { void handleSelectScene(scene); }, 30000);
        }
        return;
      }
      const bandToMode: Record<string, string> = {
        'RGB': 'truecolor',
        'SAR': 'truecolor',
        'NDVI': 'ndvi',
        'NDRE': 'ndre',
        'EVI': 'evi',
        'NDMI': 'ndmi',
        'HEAT': 'truecolor',
      };
      const mode = rawMode ? 'truecolor' : (bandToMode[band] ?? band.toLowerCase());
      const params = new URLSearchParams({ field_id: fieldId, source: scene.source, scene_date: scene.date, scene_id: scene.scene_id, mode });
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
  }, [activeField?.id, fieldBoundaries, selectedMap.band, selectedMap.backendReady, rawMode, overlay.sceneKey, overlay.url]);

  useEffect(() => () => {
    if (planetRetryRef.current) clearTimeout(planetRetryRef.current);
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
  }, []);

  const tileUrl = selectedMap.specialTile
    ?? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  // Mostra painel de cenas? Sim para mapas prontos ou no modo raw
  const showScenesPanel = selectedMap.backendReady || rawMode;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 h-full">

      {/* ── Sidebar: tipos de mapa ── */}
      <aside className="w-52 flex-shrink-0 flex flex-col border-r overflow-y-auto scrollbar-thin" style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>
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
          {/* Grupo: funcionais */}
          <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Disponíveis
          </p>
          {MAP_TYPES.filter(m => m.backendReady).map((mt) => (
            <MapNavBtn key={mt.id} mt={mt} isActive={selectedMap.id === mt.id} onClick={() => handleSelectMap(mt)} />
          ))}

          {/* Grupo: em desenvolvimento */}
          <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
            Em desenvolvimento
          </p>
          {MAP_TYPES.filter(m => !m.backendReady).map((mt) => (
            <MapNavBtn key={mt.id} mt={mt} isActive={selectedMap.id === mt.id} onClick={() => handleSelectMap(mt)} />
          ))}
        </div>
      </aside>

      {/* ── Mapa ── */}
      <div className="flex-1 relative min-w-0">
        {activeField ? (
          <MapContainer key={`${activeField.id}-${selectedMap.id}`} center={center} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url={tileUrl} />
            <FlyToBounds boundaries={fieldBoundaries ?? null} />
            {fieldBoundaries && fieldBoundaries.length > 0 && (
              <Polygon positions={fieldBoundaries} pathOptions={{
                color: overlay.url ? selectedMap.color : 'rgba(255,255,255,0.6)',
                fillColor: selectedMap.color,
                fillOpacity: overlay.url ? 0 : 0.07,
                weight: 2, dashArray: overlay.url ? undefined : '5 4',
              }} />
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

        {overlay.loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-3 rounded-2xl px-8 py-5" style={{ background: 'rgba(8,8,9,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-7 h-7 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-white">Carregando imagem…</p>
            </div>
          </div>
        )}

        {overlay.error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>error</span>
            <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{overlay.error}</p>
            <button onClick={() => setOverlay((s) => ({ ...s, error: null }))} style={{ color: '#f87171' }}><span className="material-symbols-outlined text-sm">close</span></button>
          </div>
        )}

        {/* Badge imagem carregada */}
        {overlay.url && !overlay.loading && (
          <div className="absolute top-3 left-3 z-[500] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(8,8,9,0.9)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: selectedMap.color }}>{selectedMap.icon}</span>
            <span className="text-[11px] font-bold text-white">{rawMode ? 'RGB (bruto)' : selectedMap.name}</span>
            <button onClick={() => { if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; } setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null }); }} style={{ color: '#64748b' }}>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Painel direito ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-l overflow-hidden" style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: selectedMap.bgColor }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="material-symbols-outlined text-base" style={{ color: selectedMap.color }}>{selectedMap.icon}</span>
            <span className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.name}</span>
            {selectedMap.backendReady
              ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded ml-auto" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>ATIVO</span>
              : <span className="text-[9px] font-black px-1.5 py-0.5 rounded ml-auto" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>EM DEV</span>
            }
          </div>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--muted)' }}>{selectedMap.description}</p>
        </div>

        {/* Specs */}
        <div className="px-3 py-2 flex items-center gap-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div><p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Resolução</p><p className="text-[11px] font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.resolution}</p></div>
          <div className="w-px h-5" style={{ background: 'var(--border)' }} />
          <div><p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Revisita</p><p className="text-[11px] font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>{selectedMap.updateFreq}</p></div>
        </div>

        {/* Tabs S1/S2/Planet — apenas para mapas com imagens */}
        {showScenesPanel && selectedMap.specialMode !== 'topo' && selectedMap.specialMode !== 'request' && (
          <div className="flex gap-1 p-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            {(['s2', 's1', 'planet'] as SatSource[]).map((src) => {
              const info = SAT_INFO[src];
              const isCompat = selectedMap.compatibleSources.includes(src) || selectedMap.compatibleSources.length === 0 || rawMode;
              const isActive = satTab === src;
              const count = src === 's1' ? scenes.s1.length : src === 'planet' ? scenes.planet.length : scenes.s2.length;
              return (
                <button key={src} onClick={() => setSatTab(src)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all"
                  style={{ background: isActive ? info.color + '18' : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? info.color + '44' : 'var(--border)'}`, opacity: !isCompat ? 0.4 : 1 }}
                  title={!isCompat ? `${info.label} não disponível para ${selectedMap.name}` : info.label}>
                  <span className="material-symbols-outlined text-base" style={{ color: isActive ? info.color : 'var(--muted)' }}>{info.icon}</span>
                  <span className="text-[9px] font-bold" style={{ color: isActive ? info.color : 'var(--muted)' }}>{src === 's2' ? 'S-2' : src === 's1' ? 'S-1' : 'Planet'}</span>
                  {scenes.fieldId && count > 0 && <span className="text-[8px]" style={{ color: 'var(--muted)' }}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Conteúdo do painel */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Modo topografia */}
          {selectedMap.specialMode === 'topo' ? (
            <div className="p-4 text-center flex flex-col items-center gap-3 pt-6">
              <span className="material-symbols-outlined text-4xl" style={{ color: selectedMap.color }}>landscape</span>
              <p className="text-xs font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>Mapa Topográfico Ativo</p>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>Curvas de nível via OpenTopoMap. Dados SRTM/ALOS — resolução 12.5 m.</p>
            </div>
          ) : selectedMap.specialMode === 'request' ? (
            <div className="p-4 flex flex-col gap-3 pt-4">
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>Gerado pela IA com base nas zonas de manejo do talhão ativo.</p>
              {activeField && (
                <button className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2" style={{ background: selectedMap.color, color: '#fff' }}>
                  <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                  Solicitar análise prescritiva
                </button>
              )}
            </div>
          ) : !showScenesPanel ? (
            /* Índice não pronto no backend */
            <IndexPendingPanel
              mt={selectedMap}
              activeFieldName={activeField?.name ?? null}
              onViewRaw={() => setRawMode(true)}
            />
          ) : (
            /* Lista de cenas */
            <div className="p-2">
              {rawMode && !selectedMap.backendReady && (
                <div className="mb-2 mx-1 px-2.5 py-2 rounded-xl flex items-center gap-2" style={{ background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <span className="material-symbols-outlined text-sm" style={{ color: '#60a5fa' }}>info</span>
                  <p className="text-[10px]" style={{ color: '#93c5fd' }}>Mostrando imagem RGB bruta (sem processamento de índice)</p>
                  <button onClick={() => setRawMode(false)} style={{ color: '#60a5fa', marginLeft: 'auto' }}>
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}
              <p className="px-1 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Imagens disponíveis</p>
              {!activeField ? (
                <p className="text-[11px] py-4 text-center" style={{ color: 'var(--muted)' }}>Selecione um talhão.</p>
              ) : scenes.loading ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Buscando…</p>
                </div>
              ) : tabScenes.length === 0 ? (
                <div className="py-4 text-center">
                  <span className="material-symbols-outlined text-2xl block mb-1" style={{ color: 'var(--muted)' }}>cloud_off</span>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Nenhuma imagem nos últimos 90 dias.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tabScenes.map((scene) => {
                    const band = rawMode ? 'RGB' : selectedMap.band;
                    const key = `${activeField?.id}|${band}|${scene.scene_id}`;
                    return (
                      <SceneRow key={scene.scene_id} scene={scene}
                        isActive={overlay.sceneKey === key}
                        isLoading={overlay.loading && overlay.sceneKey === key}
                        onClick={() => void handleSelectScene(scene)} />
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

// ── Botão de navegação ────────────────────────────────────────────────────────
function MapNavBtn({ mt, isActive, onClick }: { mt: MapType; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl px-2.5 py-2 transition-all flex items-center gap-2"
      style={{ background: isActive ? mt.bgColor : 'transparent', border: `1px solid ${isActive ? mt.color + '44' : 'transparent'}` }}>
      <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: mt.color }}>{mt.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold truncate" style={{ color: isActive ? mt.color : 'var(--text, #e2e8f0)' }}>{mt.name}</p>
        <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{mt.band}</p>
      </div>
      {!mt.backendReady && <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: '#fbbf24' }}>engineering</span>}
    </button>
  );
}
