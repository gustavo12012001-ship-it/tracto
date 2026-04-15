// src/pages/Maps.tsx — Hub de Mapas Agronômicos
// NDVI, NDRE, EVI, Calor, Topografia, Aplicação, Umidade, SAR

import { useState } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface MapType {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  tileLayer: 'satellite' | 'osm' | 'topo' | 'dark';
  fillOpacity: number;
  legend: { color: string; label: string }[];
  source: string;
  resolution: string;
  updateFreq: string;
  band?: string;
}

const MAP_TYPES: MapType[] = [
  {
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Índice de Vegetação por Diferença Normalizada',
    description: 'Mede saúde e densidade da vegetação. Valores altos indicam vegetação vigorosa. Essencial para monitoramento de lavouras e detecção de estresse.',
    icon: 'grass',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    tileLayer: 'satellite',
    fillOpacity: 0.22,
    band: 'NDVI',
    legend: [
      { color: '#d73027', label: '< 0.1 — Sem vegetação' },
      { color: '#fc8d59', label: '0.1–0.3 — Esparsa' },
      { color: '#fee08b', label: '0.3–0.5 — Moderada' },
      { color: '#d9ef8b', label: '0.5–0.7 — Boa' },
      { color: '#1a9850', label: '> 0.7 — Densa / saudável' },
    ],
    source: 'Sentinel-2 (ESA)',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'ndre',
    name: 'NDRE',
    fullName: 'Índice de Vegetação Red-Edge',
    description: 'Detecta estresse precoce e teor de clorofila. Mais sensível que o NDVI em dossel denso. Ideal para monitoramento fino e nutrição nitrogenada.',
    icon: 'biotech',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    tileLayer: 'satellite',
    fillOpacity: 0.22,
    band: 'NDRE',
    legend: [
      { color: '#9b2226', label: '< 0.1 — Estresse severo' },
      { color: '#e9d8a6', label: '0.1–0.25 — Estresse leve' },
      { color: '#94d2bd', label: '0.25–0.4 — Normal' },
      { color: '#0a9396', label: '0.4–0.55 — Saudável' },
      { color: '#005f73', label: '> 0.55 — Muito saudável' },
    ],
    source: 'Sentinel-2 (ESA)',
    resolution: '20 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'evi',
    name: 'EVI',
    fullName: 'Índice de Vegetação Melhorado',
    description: 'Aprimora o NDVI reduzindo influência do solo e da atmosfera. Mais robusto em áreas com vegetação muito densa ou com alta concentração de aerossóis.',
    icon: 'eco',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    tileLayer: 'satellite',
    fillOpacity: 0.20,
    band: 'EVI',
    legend: [
      { color: '#dc2626', label: '< 0.2 — Baixo' },
      { color: '#facc15', label: '0.2–0.4 — Médio' },
      { color: '#4ade80', label: '0.4–0.6 — Alto' },
      { color: '#166534', label: '> 0.6 — Muito alto' },
    ],
    source: 'Sentinel-2 / MODIS',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'sar',
    name: 'SAR / Radar',
    fullName: 'Imageamento por Radar de Abertura Sintética',
    description: 'Penetra nuvens e chuva — monitora a lavoura independente das condições climáticas. Detecta biomassa, estrutura do dossel e umidade do solo.',
    icon: 'radar',
    color: '#94a3b8',
    bgColor: 'rgba(148,163,184,0.12)',
    tileLayer: 'dark',
    fillOpacity: 0.18,
    band: 'SAR',
    legend: [
      { color: '#1e293b', label: 'Baixa retrodispersão' },
      { color: '#475569', label: 'Média retrodispersão' },
      { color: '#e2e8f0', label: 'Alta retrodispersão' },
    ],
    source: 'Sentinel-1 (ESA)',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
  },
  {
    id: 'moisture',
    name: 'Umidade',
    fullName: 'Índice de Umidade da Vegetação e Solo',
    description: 'Estima conteúdo de água na vegetação e no solo superficial. Auxilia no manejo de irrigação e na identificação precoce de estresse hídrico.',
    icon: 'water_drop',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.12)',
    tileLayer: 'satellite',
    fillOpacity: 0.25,
    band: 'NDMI',
    legend: [
      { color: '#ea580c', label: 'Seco — estresse hídrico' },
      { color: '#fde68a', label: 'Moderado' },
      { color: '#67e8f9', label: 'Normal' },
      { color: '#0284c7', label: 'Úmido' },
    ],
    source: 'Sentinel-1 SAR + Sentinel-2',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
  },
  {
    id: 'heat',
    name: 'Mapa de Calor',
    fullName: 'Variabilidade de Produtividade — Zonas de Manejo',
    description: 'Identifica zonas de manejo por variabilidade histórica de produtividade. Base para agricultura de precisão e definição de receitas de aplicação variável.',
    icon: 'thermostat',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    tileLayer: 'satellite',
    fillOpacity: 0.30,
    legend: [
      { color: '#1e40af', label: 'Zona baixa produtividade' },
      { color: '#16a34a', label: 'Zona média produtividade' },
      { color: '#dc2626', label: 'Zona alta produtividade' },
    ],
    source: 'Histórico multitemporal',
    resolution: '30 m/pixel',
    updateFreq: 'Por safra',
  },
  {
    id: 'topography',
    name: 'Topografia',
    fullName: 'Modelo Digital de Elevação e Declividade',
    description: 'Visualiza curvas de nível, declividade e drenagem da área. Fundamental para planejamento de plantio, irrigação, manejo de erosão e zoneamento.',
    icon: 'landscape',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    tileLayer: 'topo',
    fillOpacity: 0.12,
    legend: [
      { color: '#1a5276', label: 'Baixada (< 5% declive)' },
      { color: '#2ecc71', label: 'Suave (5–10%)' },
      { color: '#f39c12', label: 'Moderado (10–20%)' },
      { color: '#e74c3c', label: 'Íngreme (> 20%)' },
    ],
    source: 'SRTM / OpenTopoMap',
    resolution: '12.5 m/pixel',
    updateFreq: 'Estático (terreno)',
  },
  {
    id: 'application',
    name: 'Aplicação',
    fullName: 'Mapa de Aplicação Prescritiva',
    description: 'Gera receitas de aplicação variável de insumos (fertilizantes, defensivos) com base em zonas de manejo. Reduz custos e aumenta eficiência agronômica.',
    icon: 'agriculture',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.12)',
    tileLayer: 'satellite',
    fillOpacity: 0.28,
    legend: [
      { color: '#bfdbfe', label: 'Dose mínima (kg/ha)' },
      { color: '#3b82f6', label: 'Dose média (kg/ha)' },
      { color: '#1e3a8a', label: 'Dose máxima (kg/ha)' },
    ],
    source: 'Gerado por IA + NDVI',
    resolution: 'Variável por talhão',
    updateFreq: 'Por demanda / safra',
  },
];

// ── Tile URLs ─────────────────────────────────────────────────────────────────
const TILE_URLS: Record<MapType['tileLayer'], string> = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  dark: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function Maps() {
  const { fields, activeFieldId, activeFarmId, farms } = useAppStore();
  const [selectedMap, setSelectedMap] = useState<MapType>(MAP_TYPES[0]);
  const [useTopoOverride, setUseTopoOverride] = useState(false);

  const activeField = fields.find((f) => f.id === activeFieldId) ?? fields[0] ?? null;
  const activeFarm = farms.find((f) => f.id === (activeField?.farm_id ?? activeFarmId)) ?? null;

  const center: [number, number] = activeField
    ? [activeField.lat, activeField.lng]
    : [-15.7801, -47.9292];

  const zoom = activeField ? 14 : 5;
  const fieldBoundaries = activeField?.boundaries as [number, number][] | undefined;

  const activeTileUrl = useTopoOverride
    ? TILE_URLS.topo
    : TILE_URLS[selectedMap.tileLayer];

  function handleSelectMap(mt: MapType) {
    setSelectedMap(mt);
    setUseTopoOverride(false);
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 h-full">

      {/* ── Painel lateral ── */}
      <aside
        className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto scrollbar-thin"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>map</span>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>Mapas Agronômicos</h2>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {activeField ? (
              <>
                <span style={{ color: 'var(--primary)' }}>{activeField.name}</span>
                {activeFarm ? ` · ${activeFarm.name}` : ''}
              </>
            ) : (
              'Selecione um talhão no mapa'
            )}
          </p>
        </div>

        {/* Map type list */}
        <div className="p-3 space-y-1">
          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Tipos de mapa
          </p>
          {MAP_TYPES.map((mt) => {
            const isActive = selectedMap.id === mt.id;
            return (
              <button
                key={mt.id}
                onClick={() => handleSelectMap(mt)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{
                  background: isActive ? mt.bgColor : 'transparent',
                  border: `1px solid ${isActive ? mt.color + '55' : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="material-symbols-outlined text-xl flex-shrink-0"
                    style={{ color: mt.color }}
                  >
                    {mt.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: isActive ? mt.color : 'var(--text, #e2e8f0)' }}
                      >
                        {mt.name}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--muted)' }}>
                      {mt.source}
                    </p>
                  </div>
                  {isActive && (
                    <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: mt.color }}>
                      chevron_right
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
          style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl" style={{ color: selectedMap.color }}>
              {selectedMap.icon}
            </span>
            <div>
              <h3 className="text-sm font-bold leading-tight" style={{ color: 'var(--text, #e2e8f0)' }}>
                {selectedMap.name}
                {selectedMap.band && (
                  <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded align-middle"
                    style={{ background: selectedMap.bgColor, color: selectedMap.color }}>
                    {selectedMap.band}
                  </span>
                )}
              </h3>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{selectedMap.fullName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Topo overlay toggle */}
            <button
              onClick={() => setUseTopoOverride((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
              style={{
                background: useTopoOverride ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
                border: `1px solid ${useTopoOverride ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                color: useTopoOverride ? '#fbbf24' : 'var(--muted)',
              }}
              title="Alternar base topográfica"
            >
              <span className="material-symbols-outlined text-sm">terrain</span>
              Topo
            </button>

            {/* Fonte badge */}
            <span
              className="hidden sm:block text-[10px] font-medium px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              {selectedMap.source}
            </span>

            {/* Atualização */}
            <span
              className="hidden md:flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              {selectedMap.updateFreq}
            </span>

            {/* Export */}
            <button
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'var(--primary-dim)',
                border: '1px solid var(--primary-border)',
                color: 'var(--primary)',
              }}
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Exportar
            </button>
          </div>
        </div>

        {/* Map + info */}
        <div className="flex-1 flex min-h-0">

          {/* Map */}
          <div className="flex-1 relative min-w-0">
            {activeField ? (
              <MapContainer
                key={`${activeField.id}-${selectedMap.id}-${useTopoOverride}`}
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url={activeTileUrl} />
                {fieldBoundaries && fieldBoundaries.length > 0 && (
                  <Polygon
                    positions={fieldBoundaries}
                    pathOptions={{
                      color: selectedMap.color,
                      fillColor: selectedMap.color,
                      fillOpacity: selectedMap.fillOpacity,
                      weight: 2.5,
                      dashArray: selectedMap.id === 'application' ? '6 4' : undefined,
                    }}
                  />
                )}
              </MapContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--muted)' }}>map</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>Nenhum talhão selecionado</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    Acesse <strong>Mapa / Talhões</strong> e selecione um talhão para visualizar os mapas.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right info panel */}
          <div
            className="w-60 flex-shrink-0 flex flex-col border-l overflow-y-auto scrollbar-thin"
            style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
          >
            {/* Descrição */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                Sobre
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text, #e2e8f0)' }}>
                {selectedMap.description}
              </p>
            </div>

            {/* Specs */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
                Especificações
              </p>
              <div className="space-y-2.5">
                <SpecRow icon="satellite_alt" label="Fonte" value={selectedMap.source} />
                <SpecRow icon="straighten" label="Resolução" value={selectedMap.resolution} />
                <SpecRow icon="refresh" label="Revisita" value={selectedMap.updateFreq} />
                {selectedMap.band && (
                  <SpecRow icon="functions" label="Índice" value={selectedMap.band} />
                )}
              </div>
            </div>

            {/* Legenda */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
                Legenda
              </p>
              <div className="space-y-2">
                {selectedMap.legend.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded flex-shrink-0"
                      style={{ background: item.color, border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão de ação */}
            <div className="p-4">
              <button
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                }}
              >
                <span className="material-symbols-outlined text-sm">satellite_alt</span>
                Gerar análise
              </button>
              {activeField && (
                <p className="text-[10px] text-center mt-2" style={{ color: 'var(--muted)' }}>
                  Talhão: {activeField.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SpecRow ───────────────────────────────────────────────────────────────────
function SpecRow({ icon, label, value, valueColor }: {
  icon: string; label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>{icon}</span>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <span className="text-[10px] font-semibold text-right" style={{ color: valueColor ?? 'var(--text, #e2e8f0)' }}>
        {value}
      </span>
    </div>
  );
}
