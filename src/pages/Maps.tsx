// src/pages/Maps.tsx — Hub de Mapas Agronômicos
// NDVI, NDRE, Calor, Topografia, Aplicação e mais

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';

// ── Tipos de mapa disponíveis ─────────────────────────────────────────────────
interface MapType {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  available: boolean;
  comingSoon?: boolean;
  legend: { color: string; label: string }[];
  source: string;
  resolution: string;
  updateFreq: string;
}

const MAP_TYPES: MapType[] = [
  {
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Índice de Vegetação por Diferença Normalizada',
    description: 'Mede saúde e densidade da vegetação. Valores altos indicam vegetação vigorosa e saudável. Essencial para monitoramento de lavouras.',
    icon: 'grass',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    available: true,
    legend: [
      { color: '#d73027', label: 'Sem vegetação (< 0.1)' },
      { color: '#fc8d59', label: 'Vegetação esparsa (0.1–0.3)' },
      { color: '#fee08b', label: 'Vegetação moderada (0.3–0.5)' },
      { color: '#d9ef8b', label: 'Vegetação boa (0.5–0.7)' },
      { color: '#1a9850', label: 'Vegetação densa (> 0.7)' },
    ],
    source: 'Sentinel-2 (ESA)',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'ndre',
    name: 'NDRE',
    fullName: 'Índice de Vegetação Red-Edge',
    description: 'Detecta estresse precoce da vegetação e teor de clorofila. Mais sensível que o NDVI em dossel denso. Ideal para monitoramento fino.',
    icon: 'biotech',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    available: true,
    legend: [
      { color: '#9b2226', label: 'Estresse severo (< 0.1)' },
      { color: '#e9d8a6', label: 'Estresse leve (0.1–0.25)' },
      { color: '#94d2bd', label: 'Normal (0.25–0.4)' },
      { color: '#0a9396', label: 'Saudável (0.4–0.55)' },
      { color: '#005f73', label: 'Muito saudável (> 0.55)' },
    ],
    source: 'Sentinel-2 (ESA)',
    resolution: '20 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'evi',
    name: 'EVI',
    fullName: 'Índice de Vegetação Melhorado',
    description: 'Aprimora o NDVI reduzindo influência do solo e da atmosfera. Mais robusto em áreas com vegetação muito densa ou com aerossóis.',
    icon: 'eco',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    available: false,
    comingSoon: true,
    legend: [
      { color: '#dc2626', label: 'Baixo (< 0.2)' },
      { color: '#facc15', label: 'Médio (0.2–0.4)' },
      { color: '#4ade80', label: 'Alto (0.4–0.6)' },
      { color: '#166534', label: 'Muito alto (> 0.6)' },
    ],
    source: 'Sentinel-2 / MODIS',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 5 dias',
  },
  {
    id: 'heat',
    name: 'Mapa de Calor',
    fullName: 'Variabilidade de Produtividade (Zonas de Manejo)',
    description: 'Identifica zonas de manejo por variabilidade histórica de produtividade. Base para agricultura de precisão e aplicação variável.',
    icon: 'thermostat',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    available: false,
    comingSoon: true,
    legend: [
      { color: '#1e40af', label: 'Zona baixa' },
      { color: '#22c55e', label: 'Zona média' },
      { color: '#ef4444', label: 'Zona alta' },
    ],
    source: 'Histórico + Satélite',
    resolution: '30 m/pixel',
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
    available: false,
    comingSoon: true,
    legend: [
      { color: '#1a5276', label: 'Baixada (< 5%)' },
      { color: '#2ecc71', label: 'Suave (5–10%)' },
      { color: '#f39c12', label: 'Moderado (10–20%)' },
      { color: '#e74c3c', label: 'Íngreme (> 20%)' },
    ],
    source: 'SRTM / ALOS',
    resolution: '12.5 m/pixel',
    updateFreq: 'Estático (terreno)',
  },
  {
    id: 'application',
    name: 'Aplicação',
    fullName: 'Mapa de Aplicação Prescritiva',
    description: 'Gera receitas de aplicação variável de insumos (fertilizantes, defensivos) baseadas em zonas de manejo. Reduz custos e aumenta eficiência.',
    icon: 'agriculture',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.12)',
    available: false,
    comingSoon: true,
    legend: [
      { color: '#bfdbfe', label: 'Dose mínima' },
      { color: '#3b82f6', label: 'Dose média' },
      { color: '#1e3a8a', label: 'Dose máxima' },
    ],
    source: 'Gerado pelo sistema',
    resolution: 'Variável',
    updateFreq: 'Por demanda',
  },
  {
    id: 'moisture',
    name: 'Umidade',
    fullName: 'Índice de Umidade da Vegetação e Solo',
    description: 'Estima conteúdo de água na vegetação e solo superficial. Auxilia no manejo de irrigação e identificação de estresse hídrico.',
    icon: 'water_drop',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.12)',
    available: false,
    comingSoon: true,
    legend: [
      { color: '#ea580c', label: 'Seco (estresse hídrico)' },
      { color: '#facc15', label: 'Normal' },
      { color: '#0284c7', label: 'Úmido' },
    ],
    source: 'Sentinel-1 (SAR) + S-2',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
  },
  {
    id: 'sar',
    name: 'SAR / Radar',
    fullName: 'Imageamento por Radar de Abertura Sintética',
    description: 'Penetra nuvens e chuva. Monitora cultura independente de condições climáticas. Detecta biomassa, estrutura do dossel e umidade do solo.',
    icon: 'radar',
    color: '#64748b',
    bgColor: 'rgba(100,116,139,0.12)',
    available: true,
    legend: [
      { color: '#1e293b', label: 'Baixa retrodispersão' },
      { color: '#94a3b8', label: 'Média retrodispersão' },
      { color: '#f8fafc', label: 'Alta retrodispersão' },
    ],
    source: 'Sentinel-1 (ESA)',
    resolution: '10 m/pixel',
    updateFreq: 'A cada 6 dias',
  },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function Maps() {
  const { fields, activeFieldId, activeFarmId, farms } = useAppStore();
  const [selectedMap, setSelectedMap] = useState<MapType>(MAP_TYPES[0]);
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite'>('satellite');

  const activeField = fields.find((f) => f.id === activeFieldId) ?? fields[0] ?? null;
  const activeFarm = farms.find((f) => f.id === (activeField?.farm_id ?? activeFarmId)) ?? null;

  // Center map on active field or Brazil
  const center: [number, number] = activeField
    ? [activeField.lat, activeField.lng]
    : [-15.7801, -47.9292];

  const zoom = activeField ? 14 : 5;

  const fieldBoundaries = activeField?.boundaries as [number, number][] | undefined;

  const tileUrl =
    mapLayer === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 h-full">
      {/* ── Painel lateral de tipos de mapa ── */}
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
              <span>
                <span style={{ color: 'var(--primary)' }}>{activeField.name}</span>
                {activeFarm ? ` · ${activeFarm.name}` : ''}
              </span>
            ) : (
              'Selecione um talhão no mapa'
            )}
          </p>
        </div>

        {/* Map type cards */}
        <div className="p-3 space-y-1.5">
          <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Tipos de mapa
          </p>
          {MAP_TYPES.map((mt) => (
            <button
              key={mt.id}
              onClick={() => setSelectedMap(mt)}
              className="w-full text-left rounded-xl p-3 transition-all"
              style={{
                background: selectedMap.id === mt.id ? mt.bgColor : 'transparent',
                border: `1px solid ${selectedMap.id === mt.id ? mt.color + '44' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="material-symbols-outlined text-lg flex-shrink-0"
                  style={{ color: mt.color }}
                >
                  {mt.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color: selectedMap.id === mt.id ? mt.color : 'var(--text, #e2e8f0)' }}>
                      {mt.name}
                    </span>
                    {mt.available && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                      >
                        ATIVO
                      </span>
                    )}
                    {mt.comingSoon && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}
                      >
                        EM BREVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] mt-0.5 leading-tight truncate" style={{ color: 'var(--muted)' }}>
                    {mt.fullName}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg" style={{ color: selectedMap.color }}>
              {selectedMap.icon}
            </span>
            <div>
              <h3 className="text-sm font-bold leading-tight" style={{ color: 'var(--text, #e2e8f0)' }}>
                {selectedMap.name}
              </h3>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{selectedMap.fullName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Layer toggle */}
            <div
              className="flex rounded-lg overflow-hidden text-[11px] font-semibold"
              style={{ border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => setMapLayer('satellite')}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: mapLayer === 'satellite' ? 'var(--primary-dim)' : 'transparent',
                  color: mapLayer === 'satellite' ? 'var(--primary)' : 'var(--muted)',
                }}
              >
                Satélite
              </button>
              <button
                onClick={() => setMapLayer('osm')}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: mapLayer === 'osm' ? 'var(--primary-dim)' : 'transparent',
                  color: mapLayer === 'osm' ? 'var(--primary)' : 'var(--muted)',
                }}
              >
                OSM
              </button>
            </div>

            {/* Source badge */}
            <span
              className="text-[10px] font-medium px-2 py-1 rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              {selectedMap.source}
            </span>

            {/* Export button */}
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

        {/* Map + info layout */}
        <div className="flex-1 flex min-h-0">
          {/* Map */}
          <div className="flex-1 relative min-w-0">
            {activeField ? (
              <MapContainer
                key={`${activeField.id}-${selectedMap.id}`}
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url={tileUrl} />
                {fieldBoundaries && fieldBoundaries.length > 0 && (
                  <Polygon
                    positions={fieldBoundaries}
                    pathOptions={{
                      color: selectedMap.color,
                      fillColor: selectedMap.color,
                      fillOpacity: selectedMap.available ? 0.25 : 0.08,
                      weight: 2,
                    }}
                  />
                )}
              </MapContainer>
            ) : (
              <div
                className="h-full flex flex-col items-center justify-center gap-4"
                style={{ background: 'var(--bg)' }}
              >
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

            {/* Overlay: disponibilidade do mapa */}
            {!selectedMap.available && activeField && (
              <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                <div
                  className="rounded-2xl p-6 max-w-sm text-center mx-4"
                  style={{ background: 'var(--sidebar)', border: '1px solid var(--border)' }}
                >
                  <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: 'var(--primary)' }}>
                    {selectedMap.icon}
                  </span>
                  <h4 className="text-base font-bold mb-2" style={{ color: 'var(--text, #e2e8f0)' }}>
                    {selectedMap.name} — Em Desenvolvimento
                  </h4>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
                    {selectedMap.description}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      Disponível em breve
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right info panel */}
          <div
            className="w-64 flex-shrink-0 flex flex-col border-l overflow-y-auto scrollbar-thin"
            style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}
          >
            {/* Description */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Descrição</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text, #e2e8f0)' }}>
                {selectedMap.description}
              </p>
            </div>

            {/* Specs */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Especificações</p>
              <div className="space-y-2">
                <SpecRow icon="satellite_alt" label="Fonte" value={selectedMap.source} />
                <SpecRow icon="straighten" label="Resolução" value={selectedMap.resolution} />
                <SpecRow icon="refresh" label="Atualização" value={selectedMap.updateFreq} />
                <SpecRow
                  icon="circle"
                  label="Status"
                  value={selectedMap.available ? 'Disponível' : 'Em breve'}
                  valueColor={selectedMap.available ? '#4ade80' : '#fbbf24'}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Legenda</p>
              <div className="space-y-1.5">
                {selectedMap.legend.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ background: item.color, border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action button */}
            {activeField && (
              <div className="p-4 mt-auto border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: selectedMap.available ? 'var(--primary)' : 'var(--surface)',
                    color: selectedMap.available ? '#fff' : 'var(--muted)',
                    border: selectedMap.available ? 'none' : '1px solid var(--border)',
                    cursor: selectedMap.available ? 'pointer' : 'not-allowed',
                  }}
                >
                  {selectedMap.available ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">satellite_alt</span>
                      Gerar mapa agora
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Notificar quando disponível
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente de spec row ────────────────────────────────────────────────
function SpecRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>{icon}</span>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <span className="text-[11px] font-semibold" style={{ color: valueColor ?? 'var(--text, #e2e8f0)' }}>
        {value}
      </span>
    </div>
  );
}
