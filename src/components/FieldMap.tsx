// src/components/FieldMap.tsx — Versão 5.0
// Cadastro de talhões com campos agronômicos, arrastar para posicionar pontos e edição inline

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
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore, { type Location } from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';
import { API_URL } from '../services/api';
import ClippedImageOverlay from './ClippedImageOverlay';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

type DrawMode = 'none' | 'drawing' | 'drawing_block' | 'drawing_farm';
type MapLayer = 'osm' | 'google' | 'esri';

interface SentinelScene {
  scene_id: string;
  date: string;
  date_br: string;
  cloud_coverage: number | null;
  source: 's1' | 's2' | 'up42';
  provider?: string;
  resolution_m?: number | null;
  collection: string;
  thumbnail_url: string | null;
  orbit?: string;
}

interface ScenesState {
  s2: SentinelScene[];
  s1: SentinelScene[];
  up42: SentinelScene[];
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
  cacheStatus: 'HIT' | 'MISS' | null;
  sceneDate: string | null;
}

// ── Opções dos selects ────────────────────────────────────────────────────────

const OPCOES_IRRIGACAO = [
  { value: '', label: 'Sem irrigação' },
  { value: 'pivô central', label: 'Pivô Central' },
  { value: 'gotejo', label: 'Gotejo' },
  { value: 'aspersão', label: 'Aspersão' },
  { value: 'superficial', label: 'Superficial / Inundação' },
];

const OPCOES_ADUBACAO = [
  { value: '', label: 'Não realizada' },
  { value: 'convencional', label: 'Convencional (NPK)' },
  { value: 'orgânica', label: 'Orgânica' },
  { value: 'integrada', label: 'Integrada (conv. + org.)' },
  { value: 'foliar', label: 'Foliar' },
  { value: 'bioestimulante', label: 'Bioestimulante' },
];

const OPCOES_TEXTURA = [
  { value: '', label: 'Não informado' },
  { value: 'muito argiloso', label: 'Muito Argiloso (>60% argila)' },
  { value: 'argiloso', label: 'Argiloso (35–60%)' },
  { value: 'franco-argiloso', label: 'Franco-Argiloso' },
  { value: 'franco', label: 'Franco' },
  { value: 'franco-arenoso', label: 'Franco-Arenoso' },
  { value: 'arenoso', label: 'Arenoso (<15% argila)' },
];

const OPCOES_CULTURA_ANTERIOR = [
  { value: '', label: 'Não informado' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
  { value: 'feijão', label: 'Feijão' },
  { value: 'algodão', label: 'Algodão' },
  { value: 'cana', label: 'Cana-de-açúcar' },
  { value: 'pastagem', label: 'Pastagem' },
  { value: 'pousio', label: 'Pousio' },
];

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

// ── Estilos compartilhados ────────────────────────────────────────────────────

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40';
const selectCls = 'w-full bg-[#0d0d0f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/40 appearance-none';
const labelCls = 'text-[10px] text-slate-500 mb-1 block';

// ── Sub-componentes ───────────────────────────────────────────────────────────

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
    const fieldWithBoundaries = fields.find((f) => f.boundaries && f.boundaries.length >= 3);
    if (fieldWithBoundaries && fieldWithBoundaries.boundaries) {
      map.flyToBounds(computeBoundsFromBoundaries(fieldWithBoundaries.boundaries) as L.LatLngBoundsExpression, { padding: [80, 80], duration: 0 });
      done.current = true;
      return;
    }
    if (fields.length > 0) {
      map.setView([fields[0].lat, fields[0].lng], 15);
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

// ── MapDrawHandler: clicar para posicionar ponto (mapa permanece navegável) ───

function MapDrawHandler({
  drawMode,
  onPlacePoint,
}: {
  drawMode: DrawMode;
  onPlacePoint: (ll: { lat: number; lng: number }) => void;
}) {
  const map = useMap();
  const ghostRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (drawMode === 'none') {
      if (ghostRef.current) { map.removeLayer(ghostRef.current); ghostRef.current = null; }
      return;
    }

    const fillColor = drawMode === 'drawing_block' ? '#34d399' : drawMode === 'drawing_farm' ? '#ffffff' : '#ec5b13';

    const ghost = L.circleMarker(map.getCenter(), {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor,
      fillOpacity: 0,
      opacity: 0,
      interactive: false,
      bubblingMouseEvents: false,
    }).addTo(map);
    ghostRef.current = ghost;

    const onMove = (e: L.LeafletMouseEvent) => {
      ghost.setLatLng(e.latlng);
      ghost.setStyle({ opacity: 1, fillOpacity: 0.75 });
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      ghost.setStyle({ fillOpacity: 1 });
      ghost.setRadius(10);
      setTimeout(() => { ghost.setRadius(7); ghost.setStyle({ fillOpacity: 0.75 }); }, 120);
      onPlacePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    const onLeave = () => ghost.setStyle({ opacity: 0, fillOpacity: 0 });

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.getContainer().addEventListener('mouseleave', onLeave);

    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.getContainer().removeEventListener('mouseleave', onLeave);
      if (ghostRef.current) { map.removeLayer(ghostRef.current); ghostRef.current = null; }
    };
  }, [drawMode, map, onPlacePoint]);

  return null;
}

// ── SceneCard ─────────────────────────────────────────────────────────────────

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
  const isUp42 = scene.source === 'up42';
  const cloudOk = scene.cloud_coverage !== null && scene.cloud_coverage <= 30;
  const cloudMid = scene.cloud_coverage !== null && scene.cloud_coverage > 30 && scene.cloud_coverage <= 60;

  const iconName = isS2 ? 'satellite_alt' : isUp42 ? 'satellite_alt' : 'radar';
  const iconColor = isS2 ? '#60a5fa' : isUp42 ? '#34d399' : '#a78bfa';
  const iconBg = isS2 ? 'rgba(96,165,250,0.15)' : isUp42 ? 'rgba(52,211,153,0.15)' : 'rgba(167,139,250,0.15)';
  const resLabel = scene.resolution_m ? `≈${scene.resolution_m}m` : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-2.5 transition-all flex items-center gap-3"
      style={{
        background: isActive ? 'rgba(236,91,19,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isActive ? 'rgba(236,91,19,0.5)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <span className="material-symbols-outlined text-sm" style={{ color: iconColor }}>{iconName}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white leading-tight">{scene.date_br}</p>
        <p className="text-[10px] mt-0.5 truncate" style={{ color: '#64748b' }}>
          {isS2
            ? scene.cloud_coverage !== null ? `☁ ${scene.cloud_coverage.toFixed(0)}% nuvens` : 'Cobertura N/D'
            : isUp42 ? `${scene.provider || 'Up42'} · preview`
            : scene.orbit ? `Órbita ${scene.orbit}` : 'SAR · Radar'}
        </p>
      </div>
      {isS2 && scene.cloud_coverage !== null && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            background: cloudOk ? 'rgba(74,222,128,0.15)' : cloudMid ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
            color: cloudOk ? '#4ade80' : cloudMid ? '#fbbf24' : '#f87171',
          }}>
          {cloudOk ? 'LIMPO' : cloudMid ? 'PARCIAL' : 'NUBLADO'}
        </span>
      )}
      {isUp42 && resLabel && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>{resLabel}</span>
      )}
      {isLoading && <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin flex-shrink-0" />}
    </button>
  );
}

// ── ScenesPanel ───────────────────────────────────────────────────────────────

function ScenesPanel({
  fieldId, fieldName, scenes, activeSceneKey, overlayLoading, onClose, onSelectScene,
}: {
  fieldId: string;
  fieldName: string;
  scenes: ScenesState;
  activeSceneKey: string | null;
  overlayLoading: boolean;
  onClose: () => void;
  onSelectScene: (scene: SentinelScene) => void;
}) {
  const [tab, setTab] = useState<'s2' | 's1' | 'up42'>('s2');
  const currentScenes = tab === 's2' ? scenes.s2 : tab === 's1' ? scenes.s1 : scenes.up42;

  return (
    <div className="absolute top-4 right-16 z-[500] flex flex-col rounded-2xl overflow-hidden pointer-events-auto"
      style={{ background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', width: 280, maxHeight: 'calc(100vh - 100px)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <p className="text-xs font-bold text-white">Imagens Satelitais</p>
          <p className="text-[10px] mt-0.5 truncate max-w-[180px]" style={{ color: '#64748b' }}>{fieldName}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all" style={{ color: '#64748b' }}>
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      <div className="flex p-2 gap-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {([
          { key: 's2', label: 'Sentinel-2', icon: 'satellite_alt', color: '#60a5fa', desc: 'Óptico · RGB' },
          { key: 's1', label: 'Sentinel-1', icon: 'radar', color: '#a78bfa', desc: 'Radar · SAR' },
          { key: 'up42', label: 'Up42', icon: 'satellite_alt', color: '#34d399', desc: 'Alta Res · pay/uso' },
        ] as const).map(({ key, label, icon, color, desc }) => (
          <button key={key} onClick={() => setTab(key)} className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
            style={{ background: tab === key ? `${color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${tab === key ? `${color}40` : 'rgba(255,255,255,0.06)'}` }}>
            <span className="material-symbols-outlined text-base" style={{ color: tab === key ? color : '#64748b' }}>{icon}</span>
            <span className="text-[10px] font-bold" style={{ color: tab === key ? '#fff' : '#64748b' }}>{label}</span>
            <span className="text-[9px]" style={{ color: '#475569' }}>{desc}</span>
          </button>
        ))}
      </div>
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
              {tab === 'up42' ? 'Nenhuma imagem Up42 disponível nos últimos 90 dias.' : `Nenhuma imagem ${tab === 's2' ? 'Sentinel-2' : 'Sentinel-1'} nos últimos 90 dias.`}
            </p>
          </div>
        ) : (
          currentScenes.map((scene) => {
            const key = `${fieldId}|${scene.source}|${scene.scene_id}`;
            return (
              <SceneCard key={scene.scene_id} scene={scene} isActive={activeSceneKey === key}
                isLoading={overlayLoading && activeSceneKey === key} onClick={() => onSelectScene(scene)} />
            );
          })
        )}
      </div>
      <div className="px-4 py-2.5 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] text-center" style={{ color: '#334155' }}>
          {tab === 'up42' ? 'Up42 Marketplace · Pléiades · SPOT · Satellogic' : 'Catálogo: Copernicus · Earth Search STAC (gratuito)'}
        </p>
        {tab === 'up42' ? (
          <p className="text-[9px] text-center" style={{ color: '#1e3a5f' }}>
            Preview gratuito · imagem completa por pedido (pay/uso)
          </p>
        ) : (
          <p className="text-[9px] text-center" style={{ color: '#1e3a5f' }}>
            Renderização: Sentinel Hub Processing API (requer credenciais)
          </p>
        )}
      </div>
    </div>
  );
}

// ── Painel de formulário (criação e edição) ───────────────────────────────────

function CamposAgronomicos({
  form,
  onChange,
}: {
  form: {
    irrigacaoTipo: string;
    adubacaoTipo: string;
    ultimaAdubacao: string;
    texturaSolo: string;
    culturaAnterior: string;
    rotacaoCulturas: string;
  };
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Irrigação</label>
          <select className={selectCls} value={form.irrigacaoTipo} onChange={(e) => onChange('irrigacaoTipo', e.target.value)}>
            {OPCOES_IRRIGACAO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Textura do Solo</label>
          <select className={selectCls} value={form.texturaSolo} onChange={(e) => onChange('texturaSolo', e.target.value)}>
            {OPCOES_TEXTURA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Tipo de Adubação</label>
          <select className={selectCls} value={form.adubacaoTipo} onChange={(e) => onChange('adubacaoTipo', e.target.value)}>
            {OPCOES_ADUBACAO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cultura Anterior</label>
          <select className={selectCls} value={form.culturaAnterior} onChange={(e) => onChange('culturaAnterior', e.target.value)}>
            {OPCOES_CULTURA_ANTERIOR.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {form.adubacaoTipo && (
        <div>
          <label className={labelCls}>Última Adubação</label>
          <input type="date" className={inputCls} value={form.ultimaAdubacao} onChange={(e) => onChange('ultimaAdubacao', e.target.value)} />
        </div>
      )}
      <div>
        <label className={labelCls}>Rotação de Culturas</label>
        <input className={inputCls} placeholder="Ex: Soja → Milho → Trigo" value={form.rotacaoCulturas} onChange={(e) => onChange('rotacaoCulturas', e.target.value)} />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function FieldMap() {
  const {
    currentLocation, locationStatus, fields, farms, createField, updateField, createFarm, updateFarmBoundaries,
    removeField, activeFarmId, activeFieldId, setActiveField, setActiveFarm, setCurrentSatelliteScene,
  } = useAppStore();


  const [mapLayer, setMapLayer] = useState<MapLayer>('google');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);

  // ── Estado do desenho ─────────────────────────────────────────────────────
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');
  const [fieldIrrigacao, setFieldIrrigacao] = useState('');
  const [fieldAdubacao, setFieldAdubacao] = useState('');
  const [fieldUltimaAdubacao, setFieldUltimaAdubacao] = useState('');
  const [fieldTextura, setFieldTextura] = useState('');
  const [fieldCulturaAnterior, setFieldCulturaAnterior] = useState('');
  const [fieldRotacao, setFieldRotacao] = useState('');

  const [showBlockPicker, setShowBlockPicker] = useState(false);

  // ── Estado do bloco de pesquisa ───────────────────────────────────────────
  const [blockParentId, setBlockParentId] = useState<string | null>(null);
  const [blockName, setBlockName] = useState('');
  const [blockTratamento, setBlockTratamento] = useState('');
  const [blockNumero, setBlockNumero] = useState('');

  // ── Estado do cadastro de fazenda ─────────────────────────────────────────
  const [farmDrawName, setFarmDrawName] = useState('');
  const [farmDrawCity, setFarmDrawCity] = useState('');
  const [farmDrawTarget, setFarmDrawTarget] = useState<'new' | string>('new'); // 'new' ou farmId
  const [isSavingFarm, setIsSavingFarm] = useState(false);

  // ── Menu de ações do mapa ─────────────────────────────────────────────────
  const [actionsOpen, setActionsOpen] = useState(false);

  // ── Modal de nova fazenda ─────────────────────────────────────────────────
  const [showNewFarmModal, setShowNewFarmModal] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmCity, setNewFarmCity] = useState('');
  const [isCreatingFarm, setIsCreatingFarm] = useState(false);

  // ── Fazenda alvo ao desenhar talhão ───────────────────────────────────────
  const [drawFarmId, setDrawFarmId] = useState<string | null>(null);

  // ── Estado da edição ──────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<Location | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', cultura: '', variedade: '', dataPlantio: '',
    irrigacaoTipo: '', adubacaoTipo: '', ultimaAdubacao: '',
    texturaSolo: '', culturaAnterior: '', rotacaoCulturas: '',
  });

  // ── Cenas e overlay ───────────────────────────────────────────────────────
  const [showScenesPanel, setShowScenesPanel] = useState(false);
  const [scenes, setScenes] = useState<ScenesState>({ s2: [], s1: [], up42: [], loading: false, error: null, fieldId: null });
  const [overlay, setOverlay] = useState<OverlayState>({ url: null, bounds: null, loading: false, error: null, sceneKey: null, cacheStatus: null, sceneDate: null });

  // Ref de timer não é mais usado para Up42 (não tem asset activation), mantido por compatibilidade
  const planetRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const loadingScenesFieldRef = useRef<string | null>(null);

  const center: [number, number] = currentLocation ? [currentLocation.lat, currentLocation.lng] : [-18.9188, -48.2768];

  // ── Buscar cenas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showScenesPanel || !activeFieldId) return;
    if (scenes.fieldId === activeFieldId && !scenes.loading) return;
    if (loadingScenesFieldRef.current === activeFieldId) return;

    loadingScenesFieldRef.current = activeFieldId;
    setScenes({ s2: [], s1: [], up42: [], loading: true, error: null, fieldId: activeFieldId });

    const fetchScenes = async () => {
      try {
        const headers = await buildAuthHeaders();
        const [sentinelResp, up42Resp] = await Promise.allSettled([
          fetch(`${API_URL}/api/sentinel/scenes?field_id=${activeFieldId}&lookback_days=90`, { headers }),
          fetch(`${API_URL}/api/up42/scenes?field_id=${activeFieldId}&lookback_days=90`, { headers }),
        ]);
        const sentinelData = sentinelResp.status === 'fulfilled' && sentinelResp.value.ok
          ? await sentinelResp.value.json() : { s2: [], s1: [] };
        const up42Data = up42Resp.status === 'fulfilled' && up42Resp.value.ok
          ? await up42Resp.value.json() : { scenes: [] };
        setScenes({ s2: sentinelData.s2 || [], s1: sentinelData.s1 || [], up42: up42Data.scenes || [], loading: false, error: null, fieldId: activeFieldId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao buscar cenas.';
        setScenes({ s2: [], s1: [], up42: [], loading: false, error: msg, fieldId: activeFieldId });
      } finally {
        if (loadingScenesFieldRef.current === activeFieldId) loadingScenesFieldRef.current = null;
      }
    };

    void fetchScenes();
  }, [showScenesPanel, activeFieldId, scenes.fieldId, scenes.loading]);

  // ── Carregar overlay ──────────────────────────────────────────────────────
  const handleSelectScene = async (scene: SentinelScene) => {
    if (!activeFieldId) return;
    const { source, date = '', scene_id: sceneId } = scene;
    const sceneKey = `${activeFieldId}|${source}|${sceneId}`;
    if (overlay.sceneKey === sceneKey && overlay.url) return;

    const activeField = fields.find((f) => f.id === activeFieldId);
    if (!activeField?.boundaries || activeField.boundaries.length < 3) return;

    const bounds = computeBoundsFromBoundaries(activeField.boundaries);
    setOverlay({ url: null, bounds, loading: true, error: null, sceneKey, cacheStatus: null, sceneDate: null });
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }

    try {
      const headers = await buildAuthHeaders();

      if (source === 'up42') {
        if (!sceneId) return;
        const resp = await fetch(`${API_URL}/api/up42/overlay?field_id=${activeFieldId}&scene_id=${sceneId}`, { headers });
        if (!resp.ok) {
          let errorMsg = `Erro ${resp.status}`;
          try { const payload = await resp.json() as { detail?: string }; errorMsg = payload.detail || errorMsg; } catch { errorMsg = await resp.text().catch(() => errorMsg); }
          throw new Error(errorMsg);
        }

        const boundsHeader = resp.headers.get('X-Scene-Bounds');
        let overlayBounds: L.LatLngBoundsExpression = bounds;
        if (boundsHeader) {
          const [s, w, n, e] = boundsHeader.split(',').map(Number);
          if (!isNaN(s) && !isNaN(w) && !isNaN(n) && !isNaN(e)) overlayBounds = [[s, w], [n, e]];
        }

        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        prevUrlRef.current = objectUrl;
        setOverlay({ url: objectUrl, bounds: overlayBounds, loading: false, error: null, sceneKey, cacheStatus: null, sceneDate: null });
        return;
      }

      const cloud = typeof scene.cloud_coverage === 'number' ? scene.cloud_coverage : null;
      const params = new URLSearchParams({ field_id: activeFieldId, source, scene_date: date, scene_id: sceneId });
      if (cloud !== null) params.set('cloud_coverage', String(cloud));

      const resp = await fetch(`${API_URL}/api/sentinel/overlay?${params.toString()}`, { headers });
      if (!resp.ok) {
        let errorMsg = `Erro ${resp.status}`;
        try {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const json = await resp.json() as { detail?: string };
            errorMsg = json.detail || errorMsg;
          } else {
            const text = await resp.text();
            try { const json = JSON.parse(text) as { detail?: string }; errorMsg = json.detail || text.slice(0, 200) || errorMsg; }
            catch { errorMsg = text.slice(0, 200) || errorMsg; }
          }
        } catch { /* mantém errorMsg */ }
        throw new Error(errorMsg);
      }

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      prevUrlRef.current = objectUrl;
      const cacheStatus = resp.headers.get('X-Cache') as 'HIT' | 'MISS' | null;
      const sceneDateHeader = resp.headers.get('X-Scene-Date');
      setOverlay({ url: objectUrl, bounds, loading: false, error: null, sceneKey, cacheStatus: cacheStatus ?? null, sceneDate: sceneDateHeader });

      if (activeFieldId && (source === 's1' || source === 's2')) {
        setCurrentSatelliteScene({ fieldId: activeFieldId, source: source as 's1' | 's2', sceneId, sceneDate: date || sceneDateHeader || null, sceneDate_br: scene.date_br || null, cloudCoverage: typeof scene.cloud_coverage === 'number' ? scene.cloud_coverage : null });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar imagem.';
      console.error('[overlay]', msg);
      setOverlay({ url: null, bounds, loading: false, error: msg, sceneKey, cacheStatus: null, sceneDate: null });
    }
  };

  useEffect(() => {
    if (planetRetryTimerRef.current) { clearTimeout(planetRetryTimerRef.current); planetRetryTimerRef.current = null; }
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setCurrentSatelliteScene(null);
    setOverlay({ url: null, bounds: null, loading: false, error: null, sceneKey: null, cacheStatus: null, sceneDate: null });
    setShowScenesPanel(false);
  }, [activeFieldId]);

  useEffect(() => () => {
    if (planetRetryTimerRef.current) clearTimeout(planetRetryTimerRef.current);
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
  }, []);

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

  // ── Lógica de desenho ─────────────────────────────────────────────────────
  const handlePlacePoint = useCallback((ll: { lat: number; lng: number }) => {
    setDrawPoints((p) => [...p, [ll.lat, ll.lng]]);
  }, []);

  const resetForm = () => {
    setDrawPoints([]); setFieldName(''); setFieldCultura('');
    setFieldDataPlantio(''); setFieldVariedade('');
    setFieldIrrigacao(''); setFieldAdubacao(''); setFieldUltimaAdubacao('');
    setFieldTextura(''); setFieldCulturaAnterior(''); setFieldRotacao('');
    setShowAdvancedFields(false);
    setBlockParentId(null); setBlockName(''); setBlockTratamento(''); setBlockNumero('');
    setShowBlockPicker(false);
    setFarmDrawName(''); setFarmDrawCity(''); setFarmDrawTarget('new');
    setDrawMode('none');
  };


  const finishFarmDraw = async () => {
    if (drawPoints.length < 3) { alert('Marque pelo menos 3 pontos para definir a área da fazenda.'); return; }
    const name = farmDrawName.trim();
    if (!name) { alert('Informe o nome da fazenda.'); return; }
    setIsSavingFarm(true);
    try {
      if (farmDrawTarget === 'new') {
        const farm = await createFarm(name, farmDrawCity, drawPoints);
        setActiveFarm(farm.id);
      } else {
        await updateFarmBoundaries(farmDrawTarget, drawPoints, name, farmDrawCity);
      }
      resetForm();
    } catch (err) {
      alert(`Erro ao salvar fazenda: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      setIsSavingFarm(false);
    }
  };

  const startDrawingBlock = (parentId: string) => {
    resetForm();
    setBlockParentId(parentId);
    const nextNum = fields.filter((f) => f.parent_field_id === parentId).length + 1;
    const letter = String.fromCharCode(64 + nextNum);
    setBlockName(`Bloco ${letter}`);
    setBlockNumero(String(nextNum));
    setDrawMode('drawing_block');
  };

  const finishBlock = async () => {
    if (!blockParentId) { alert('Selecione um talhão principal primeiro.'); return; }
    const parentField = fields.find((f) => f.id === blockParentId);
    const farmId = parentField?.farm_id ?? activeFarmId;
    if (!farmId) { alert('Fazenda não encontrada. Selecione uma fazenda ativa.'); return; }
    if (drawPoints.length < 3) { alert('Marque pelo menos 3 pontos.'); return; }
    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.001) { alert('Área muito pequena. Mínimo 0.001 ha.'); return; }
    const name = blockName.trim() || `Bloco ${fields.filter((f) => f.parent_field_id === blockParentId).length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];
    try {
      setIsSaving(true);
      await createField(farmId, {
        lat: centroid[0], lng: centroid[1], name, boundaries: drawPoints, areaHa,
        parent_field_id: blockParentId,
        field_type: 'research_block',
        treatment_label: blockTratamento || undefined,
        block_number: blockNumero ? parseInt(blockNumero, 10) : undefined,
      });
      resetForm();
    } catch (err: unknown) {
      alert(`Erro ao salvar bloco: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Criar fazenda via modal (nome+cidade → geocode → voa no mapa) ──────────
  const createNewFarm = async () => {
    const name = newFarmName.trim();
    if (!name) { alert('Informe o nome da fazenda.'); return; }
    setIsCreatingFarm(true);
    try {
      let geocoded: { lat: number; lng: number } | null = null;
      if (newFarmCity.trim()) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(newFarmCity)}&format=json&limit=1&countrycodes=br`,
            { headers: { 'Accept-Language': 'pt-BR' } },
          );
          const data = await res.json() as Array<{ lat: string; lon: string }>;
          if (data?.length) geocoded = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch { /* geocoding falhou, continua sem centralizar */ }
      }
      const farm = await createFarm(name, newFarmCity.trim());
      setActiveFarm(farm.id);
      if (geocoded) setFlyTarget({ ...geocoded, zoom: 13 });
      setShowNewFarmModal(false);
      setNewFarmName('');
      setNewFarmCity('');
    } catch (err) {
      alert(`Erro ao criar fazenda: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      setIsCreatingFarm(false);
    }
  };

  const finishDrawing = async () => {
    const targetFarmId = drawFarmId ?? activeFarmId;
    if (!targetFarmId) { alert('Selecione uma fazenda antes de salvar.'); return; }
    if (drawPoints.length < 3) { alert('Marque pelo menos 3 pontos para fechar o polígono.'); return; }
    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.001) { alert(`Área calculada muito pequena (${areaHa.toFixed(5)} ha). Verifique se os pontos estão no local correto.`); return; }

    const name = fieldName.trim() || `Talhão ${fields.length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];
    try {
      setIsSaving(true);
      await createField(targetFarmId, {
        lat: centroid[0], lng: centroid[1], name, boundaries: drawPoints,
        cultura: fieldCultura || undefined,
        dataPlantio: fieldDataPlantio || undefined,
        variedade: fieldVariedade || undefined,
        areaHa,
        irrigacaoTipo: fieldIrrigacao || undefined,
        adubacaoTipo: fieldAdubacao || undefined,
        ultimaAdubacao: fieldUltimaAdubacao || undefined,
        texturaSolo: fieldTextura || undefined,
        culturaAnterior: fieldCulturaAnterior || undefined,
        rotacaoCulturas: fieldRotacao || undefined,
      });
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('violates') ? '\n\nDica: verifique as permissões (RLS) da tabela fields no Supabase.'
        : msg.includes('network') || msg.includes('fetch') ? '\n\nDica: verifique sua conexão com a internet.'
        : '';
      alert(`Erro ao salvar talhão:\n${msg}${hint}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Lógica de edição ──────────────────────────────────────────────────────
  const startEditing = (field: Location) => {
    resetForm();
    setEditingField(field);
    setEditForm({
      name: field.name || '',
      cultura: field.cultura || '',
      variedade: field.variedade || '',
      dataPlantio: field.dataPlantio || '',
      irrigacaoTipo: field.irrigacaoTipo || '',
      adubacaoTipo: field.adubacaoTipo || '',
      ultimaAdubacao: field.ultimaAdubacao || '',
      texturaSolo: field.texturaSolo || '',
      culturaAnterior: field.culturaAnterior || '',
      rotacaoCulturas: field.rotacaoCulturas || '',
    });
  };

  const cancelEdit = () => setEditingField(null);

  const saveEdit = async () => {
    if (!editingField?.id) return;
    setIsSavingEdit(true);
    try {
      await updateField(editingField.id, {
        name: editForm.name || editingField.name,
        cultura: editForm.cultura || undefined,
        variedade: editForm.variedade || undefined,
        dataPlantio: editForm.dataPlantio || undefined,
        irrigacaoTipo: editForm.irrigacaoTipo || undefined,
        adubacaoTipo: editForm.adubacaoTipo || undefined,
        ultimaAdubacao: editForm.ultimaAdubacao || undefined,
        texturaSolo: editForm.texturaSolo || undefined,
        culturaAnterior: editForm.culturaAnterior || undefined,
        rotacaoCulturas: editForm.rotacaoCulturas || undefined,
      });
      setEditingField(null);
    } catch (err) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : 'desconhecido'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditFormChange = (key: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];
  const activeField = fields.find((f) => f.id === activeFieldId);

  const panelStyle: React.CSSProperties = {
    background: 'rgba(8,8,9,0.97)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.09)',
    minWidth: 440,
    maxHeight: 'calc(100vh - 120px)',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ cursor: drawMode !== 'none' ? 'crosshair' : 'default' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', background: '#080809' }} zoomControl={false}>
        <InitialCenterController />
        <ActiveFieldFlyController />
        <FlyController target={flyTarget} />

        {mapLayer === 'osm' && (
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}
        {mapLayer === 'google' && (
          <>
            {/* Google Satellite — cobertura total do Brasil */}
            <TileLayer
              attribution="&copy; Google"
              url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              subdomains={['0', '1', '2', '3']}
              maxZoom={21}
              maxNativeZoom={20}
            />
            {/* Labels overlay — nomes de cidades e ruas */}
            <TileLayer
              attribution=""
              url="https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
              subdomains={['0', '1', '2', '3']}
              maxZoom={21}
              maxNativeZoom={20}
              opacity={0.7}
            />
          </>
        )}
        {mapLayer === 'esri' && (
          <TileLayer
            attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={21}
            maxNativeZoom={19}
          />
        )}

        {overlay.url && overlay.bounds && activeField?.boundaries && activeField.boundaries.length >= 3 ? (
          <ClippedImageOverlay
            url={overlay.url}
            bounds={overlay.bounds}
            opacity={0.9}
            fieldBoundaries={activeField.boundaries as [number, number][]}
          />
        ) : overlay.url && overlay.bounds && (
          <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.9} zIndex={400} />
        )}

        <MapDrawHandler drawMode={drawMode} onPlacePoint={handlePlacePoint} />

        {/* Polígonos das fazendas — camada de fundo */}
        {farms.map((farm) => farm.boundaries && farm.boundaries.length >= 3 ? (
          <Polygon
            key={`farm-${farm.id}`}
            positions={farm.boundaries}
            pathOptions={{ color: farm.id === activeFarmId ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', fillColor: 'rgba(255,255,255,0.03)', fillOpacity: 1, weight: 2, dashArray: '8 5' }}
            eventHandlers={{ click: (e) => { if (drawMode !== 'none') e.originalEvent.stopPropagation(); } }}
          >
            <Tooltip sticky direction="top">
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700 }}>🏡 {farm.name}</span>
            </Tooltip>
          </Polygon>
        ) : null)}

        {tempMarker && <Marker position={[tempMarker.lat, tempMarker.lng]}><Popup>📍 {searchQuery}</Popup></Marker>}
        {currentLocation && locationStatus === 'precise' && !fields.some((s) => s.lat === currentLocation.lat) && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}><Popup>📍 Sua localização</Popup></Marker>
        )}

        {fields.map((loc, idx) => {
          const isBlock = loc.field_type === 'research_block';
          const color = isBlock
            ? ['#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#60a5fa', '#fb923c'][idx % 6]
            : FIELD_COLORS[idx % FIELD_COLORS.length];
          const isActive = loc.id === activeFieldId;

          return (
            <Polygon
              key={loc.id}
              positions={loc.boundaries ?? [[loc.lat - 0.001, loc.lng - 0.001], [loc.lat - 0.001, loc.lng + 0.001], [loc.lat + 0.001, loc.lng + 0.001], [loc.lat + 0.001, loc.lng - 0.001]]}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isBlock ? (isActive ? 0.35 : 0.25) : (isActive ? 0.08 : 0.2),
                weight: isBlock ? (isActive ? 2.5 : 1.5) : (isActive ? 3 : 2),
                dashArray: isBlock ? '3 3' : (isActive ? undefined : '4 2'),
              }}
              eventHandlers={{ click: (e) => {
                // During drawing, absorb the click so it doesn't also place a draw point
                if (drawMode !== 'none') { e.originalEvent.stopPropagation(); return; }
                if (loc.id) setActiveField(loc.id);
              } }}
            >
              <Tooltip permanent direction="center" className="leaflet-field-label" offset={[0, 0]}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: isBlock ? 9 : 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  {loc.name}
                </span>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200 }}>
                  {isBlock && (
                    <p style={{ fontSize: 9, fontWeight: 600, color: '#34d399', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Bloco de Pesquisa {loc.parent_field_id ? `· ${fields.find((f) => f.id === loc.parent_field_id)?.name ?? ''}` : ''}
                    </p>
                  )}
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.treatment_label && <p style={{ fontSize: 11, color: '#34d399', marginBottom: 2 }}>🧪 {loc.treatment_label}</p>}
                  {loc.cultura && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🌱 {loc.cultura}{loc.variedade ? ` · ${loc.variedade}` : ''}</p>}
                  {loc.boundaries && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>📐 {polygonAreaHa(loc.boundaries).toFixed(4)} ha</p>}
                  {!isBlock && loc.irrigacaoTipo && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>💧 {loc.irrigacaoTipo}</p>}
                  {!isBlock && loc.texturaSolo && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🌍 Solo {loc.texturaSolo}</p>}
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    {!isBlock && (
                      <button onClick={() => { if (loc.id) { setActiveField(loc.id); setShowScenesPanel(true); } }}
                        style={{ fontSize: 11, color: '#ec5b13', background: 'rgba(236,91,19,0.1)', border: '1px solid rgba(236,91,19,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                        🛰 Ver Imagens
                      </button>
                    )}
                    <button onClick={() => startEditing(loc)}
                      style={{ fontSize: 11, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                      ✏ Editar
                    </button>
                    {!isBlock && loc.id && (
                      <button onClick={() => startDrawingBlock(loc.id!)}
                        style={{ fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                        🔬 + Bloco
                      </button>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 6, padding: '3px 8px', textDecoration: 'none' }}>
                      📍 Ver no Maps
                    </a>
                    <button onClick={() => { if (loc.id && activeFarmId && window.confirm(`Remover "${loc.name}"?`)) removeField(activeFarmId, loc.id); }}
                      style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      🗑 Remover
                    </button>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {drawMode !== 'none' && drawPoints.length > 0 && (
          <>
            {drawPoints.length > 1 && (
              <Polyline positions={[...drawPoints, drawPoints[0]]}
                pathOptions={{
                  color: drawMode === 'drawing_block' ? '#34d399' : drawMode === 'drawing_farm' ? '#ffffff' : '#ec5b13',
                  weight: 2, dashArray: '6 4', opacity: 0.85,
                }} />
            )}
            {drawPoints.map((pt, i) => (
              <Marker key={i} position={pt} icon={L.divIcon({
                className: '',
                html: `<div style="width:10px;height:10px;background:${drawMode === 'drawing_block' ? '#34d399' : drawMode === 'drawing_farm' ? '#ffffff' : '#ec5b13'};border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
                iconAnchor: [5, 5],
              })} />
            ))}
          </>
        )}

        <ZoomControls />
      </MapContainer>

      <style>{`
        .leaflet-field-label { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-field-label::before { display: none !important; }
      `}</style>

      {/* Painel de cenas Sentinel */}
      {showScenesPanel && activeFieldId && activeField && (
        <ScenesPanel fieldId={activeFieldId} fieldName={activeField.name || 'Talhão'} scenes={scenes}
          activeSceneKey={overlay.sceneKey} overlayLoading={overlay.loading}
          onClose={() => setShowScenesPanel(false)} onSelectScene={handleSelectScene} />
      )}

      {/* Badge loading/erro do overlay */}
      {(overlay.loading || overlay.error) && (
        <div className="absolute z-[500] pointer-events-none" style={{ top: 52, left: 4 }}>
          {overlay.loading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'rgba(8,8,9,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(236,91,19,0.3)' }}>
              <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
              Carregando imagem...
            </div>
          )}
          {!overlay.loading && overlay.error && (
            <div className="px-3 py-2.5 rounded-xl text-[10px] font-medium flex flex-col gap-1"
              style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', maxWidth: 320 }}>
              <span className="font-bold flex items-center gap-1.5"><span>⚠</span><span>Imagem satelital indisponível</span></span>
              <span style={{ color: '#94a3b8' }}>{overlay.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Badge overlay ativo */}
      {overlay.url && !overlay.loading && overlay.sceneKey && (
        <div className="absolute z-[500] pointer-events-none" style={{ top: 52, left: 4 }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold"
            style={{ background: 'rgba(8,8,9,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}>
            🛰 {overlay.sceneKey?.includes('|s1|') ? 'Sentinel-1 · Radar SAR' : overlay.sceneKey?.includes('|up42|') ? 'Up42 · Imagem Alta Resolução' : 'Sentinel-2 · Cor Natural'}
            {overlay.cacheStatus === 'HIT' && ' · Cache'}
            {overlay.cacheStatus === 'MISS' && ' · Gerado agora'}
          </div>
        </div>
      )}

      {/* Barra de busca */}
      {drawMode === 'none' && !editingField && (
        <form onSubmit={handleSearch} className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 pointer-events-auto" style={{ minWidth: 300 }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1"
            style={{ background: 'rgba(8,8,9,0.88)', backdropFilter: 'blur(16px)', border: `1px solid ${searchError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
            <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#64748b', fontSize: 18 }}>search</span>
            <input className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-slate-600 focus:outline-none"
              placeholder="Buscar cidade ou coordenadas..." value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null); }} />
            {searchLoading && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />}
          </div>
          <button type="submit" disabled={searchLoading || !searchQuery.trim()} className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
            style={{ background: '#ec5b13', flexShrink: 0 }}>Ir</button>
        </form>
      )}

      {searchError && drawMode === 'none' && !editingField && (
        <div className="absolute z-[500] text-[10px] font-semibold px-3 py-1.5 rounded-lg pointer-events-none"
          style={{ top: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {searchError}
        </div>
      )}

      {/* Seletor de camadas — dropdown */}
      {drawMode === 'none' && !editingField && (
        <div className="absolute top-4 left-4 z-[500] pointer-events-auto">
          {/* Botão principal */}
          <button
            onClick={() => setLayerDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: 'rgba(8,8,9,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
              {mapLayer === 'osm' ? 'map' : mapLayer === 'esri' ? 'public' : 'travel_explore'}
            </span>
            {mapLayer === 'osm' ? 'Mapa' : mapLayer === 'esri' ? 'Esri' : 'Satélite HD'}
            <span className="material-symbols-outlined text-sm transition-transform duration-150"
              style={{ transform: layerDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#94a3b8' }}>
              expand_more
            </span>
          </button>

          {/* Dropdown de opções */}
          {layerDropdownOpen && (
            <div className="mt-1 flex flex-col gap-0.5 rounded-xl overflow-hidden"
              style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 140 }}>
              {([
                { key: 'google', label: 'Satélite HD', sub: 'Google', icon: 'travel_explore' },
                { key: 'esri',   label: 'Esri',        sub: 'Melhor rural', icon: 'public' },
                { key: 'osm',    label: 'Mapa',        sub: 'OpenStreetMap', icon: 'map' },
              ] as { key: MapLayer; label: string; sub: string; icon: string }[]).map(({ key, label, sub, icon }) => (
                <button key={key}
                  onClick={() => { setMapLayer(key); setLayerDropdownOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-white/5"
                  style={{ background: mapLayer === key ? 'rgba(236,91,19,0.15)' : 'transparent', borderLeft: mapLayer === key ? '2px solid #ec5b13' : '2px solid transparent' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: mapLayer === key ? '#ec5b13' : '#64748b' }}>{icon}</span>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: mapLayer === key ? '#fff' : '#94a3b8' }}>{label}</p>
                    <p className="text-[9px]" style={{ color: '#475569' }}>{sub}</p>
                  </div>
                  {mapLayer === key && <span className="material-symbols-outlined text-sm ml-auto" style={{ color: '#ec5b13' }}>check</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botões de ação no mapa — dropdown colapsável */}
      {drawMode === 'none' && !editingField && (
        <div className="absolute top-4 right-4 z-[500] flex flex-col items-end gap-1 pointer-events-auto">
          {/* Botão principal / toggle */}
          <button
            onClick={() => setActionsOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all"
            style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}>
            <span className="material-symbols-outlined text-base">
              {actionsOpen ? 'close' : 'add'}
            </span>
            {actionsOpen ? 'Fechar' : 'Ações'}
            <span
              className="material-symbols-outlined text-base transition-transform duration-200"
              style={{ transform: actionsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              expand_more
            </span>
          </button>

          {/* Opções expansíveis */}
          {actionsOpen && (
            <div className="flex flex-col gap-1 mt-0.5">
              <button onClick={() => { setActionsOpen(false); setEditingField(null); setDrawFarmId(null); setDrawMode('drawing'); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(236,91,19,0.35)', color: '#ec5b13' }}>
                <span className="material-symbols-outlined text-base">add_location_alt</span>
                Desenhar Talhão
              </button>
              <button onClick={() => {
                setActionsOpen(false);
                const standardFields = fields.filter((f) => f.field_type !== 'research_block');
                const activeStandard = activeFieldId ? fields.find((f) => f.id === activeFieldId && f.field_type !== 'research_block') : null;
                if (activeStandard?.id) {
                  startDrawingBlock(activeStandard.id);
                } else if (standardFields.length === 1 && standardFields[0].id) {
                  startDrawingBlock(standardFields[0].id);
                } else {
                  setShowBlockPicker(true);
                }
              }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}>
                <span className="material-symbols-outlined text-base">biotech</span>
                Bloco de Pesquisa
              </button>
              <button onClick={() => { setActionsOpen(false); setShowNewFarmModal(true); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}>
                <span className="material-symbols-outlined text-base">add_home</span>
                Nova Fazenda
              </button>
            </div>
          )}
        </div>
      )}

      {/* Seletor de talhão pai para bloco de pesquisa */}
      {showBlockPicker && (
        <div className="absolute top-20 right-4 z-[500] flex flex-col gap-2 px-4 py-3 rounded-2xl pointer-events-auto"
          style={{ background: 'rgba(8,8,9,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(52,211,153,0.3)', minWidth: 220, maxHeight: 320, overflowY: 'auto' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>
            <span className="material-symbols-outlined text-xs align-middle mr-1">biotech</span>
            Selecione o talhão principal
          </p>
          {fields.filter((f) => f.field_type !== 'research_block').length === 0 ? (
            <p className="text-xs py-2" style={{ color: '#64748b' }}>Nenhum talhão disponível. Crie um talhão primeiro.</p>
          ) : (
            fields.filter((f) => f.field_type !== 'research_block').map((f) => (
              <button key={f.id} onClick={() => { setShowBlockPicker(false); if (f.id) startDrawingBlock(f.id); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left hover:bg-white/10 transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
                <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>polyline</span>
                {f.name}
                {f.areaHa && <span className="ml-auto text-[9px]" style={{ color: '#475569' }}>{f.areaHa.toFixed(1)} ha</span>}
              </button>
            ))
          )}
          <button onClick={() => setShowBlockPicker(false)} className="text-[10px] text-center py-1 hover:text-white transition-colors" style={{ color: '#475569' }}>Cancelar</button>
        </div>
      )}

      {/* Instrução de desenho */}
      {drawMode !== 'none' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white pointer-events-none"
          style={{
            background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)',
            border: `1px solid ${drawMode === 'drawing_block' ? 'rgba(52,211,153,0.4)' : drawMode === 'drawing_farm' ? 'rgba(255,255,255,0.3)' : 'rgba(236,91,19,0.3)'}`,
          }}>
          <span className="material-symbols-outlined text-base" style={{ color: drawMode === 'drawing_block' ? '#34d399' : drawMode === 'drawing_farm' ? '#fff' : '#ec5b13' }}>draw</span>
          {drawMode === 'drawing_block' ? '🔬 Bloco — ' : drawMode === 'drawing_farm' ? '🏡 Fazenda — ' : ''}
          Clique para adicionar vértices · arraste para navegar · {drawPoints.length} ponto{drawPoints.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Painel de criação de talhão */}
      {drawMode === 'drawing' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto overflow-y-auto" style={panelStyle}>
          {/* Seletor de fazenda */}
          <div>
            <label className={labelCls}>Fazenda *</label>
            <select
              className="w-full appearance-none px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none"
              style={{
                background: drawFarmId ? 'rgba(236,91,19,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${drawFarmId ? 'rgba(236,91,19,0.35)' : 'rgba(255,255,255,0.12)'}`,
                color: drawFarmId ? '#fff' : '#64748b',
              }}
              value={drawFarmId ?? ''}
              onChange={(e) => setDrawFarmId(e.target.value || null)}
            >
              <option value="" disabled style={{ background: '#0c0c0e' }}>Selecione a fazenda...</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id} style={{ background: '#0c0c0e', color: '#fff' }}>
                  {f.name}{(f.city ?? f.description) ? ` — ${f.city ?? f.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>
            {drawPoints.length} pontos · Novo Talhão
          </p>

          {/* Identificação */}
          <input className={inputCls} placeholder="Nome do talhão" value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Cultura (ex: Soja)" value={fieldCultura} onChange={(e) => setFieldCultura(e.target.value)} />
            <input className={inputCls} placeholder="Variedade" value={fieldVariedade} onChange={(e) => setFieldVariedade(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data de Plantio</label>
            <input type="date" className={inputCls} value={fieldDataPlantio} onChange={(e) => setFieldDataPlantio(e.target.value)} />
          </div>

          {/* Toggle detalhes agronômicos */}
          <button onClick={() => setShowAdvancedFields(!showAdvancedFields)}
            className="flex items-center gap-2 text-[10px] font-semibold py-2 px-3 rounded-lg transition-all"
            style={{ background: showAdvancedFields ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: showAdvancedFields ? '#60a5fa' : '#64748b' }}>
            <span className="material-symbols-outlined text-sm">{showAdvancedFields ? 'expand_less' : 'expand_more'}</span>
            Detalhes Agronômicos
          </button>

          {showAdvancedFields && (
            <CamposAgronomicos
              form={{ irrigacaoTipo: fieldIrrigacao, adubacaoTipo: fieldAdubacao, ultimaAdubacao: fieldUltimaAdubacao, texturaSolo: fieldTextura, culturaAnterior: fieldCulturaAnterior, rotacaoCulturas: fieldRotacao }}
              onChange={(key, value) => {
                if (key === 'irrigacaoTipo') setFieldIrrigacao(value);
                else if (key === 'adubacaoTipo') setFieldAdubacao(value);
                else if (key === 'ultimaAdubacao') setFieldUltimaAdubacao(value);
                else if (key === 'texturaSolo') setFieldTextura(value);
                else if (key === 'culturaAnterior') setFieldCulturaAnterior(value);
                else if (key === 'rotacaoCulturas') setFieldRotacao(value);
              }}
            />
          )}

          {drawPoints.length >= 3 && (
            <p className="text-[10px] text-slate-400 text-center">
              Área: <span className="font-bold text-white">{polygonAreaHa(drawPoints).toFixed(2)} ha</span>
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={finishDrawing} disabled={isSaving || drawPoints.length < 3 || !drawFarmId}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: '#ec5b13' }}>
              {isSaving ? 'Salvando...' : !drawFarmId ? 'Selecione a fazenda' : 'Salvar Talhão'}
            </button>
            <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Painel de cadastro / edição de fazenda */}
      {drawMode === 'drawing_farm' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto" style={panelStyle}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <span className="text-sm">🏡</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white">
              {farmDrawTarget === 'new' ? 'Nova Fazenda' : 'Editar Área da Fazenda'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Nome da Fazenda *</label>
              <input className={inputCls} placeholder="Ex: Fazenda Santa Rosa" value={farmDrawName} onChange={(e) => setFarmDrawName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Município / UF</label>
              <input className={inputCls} placeholder="Ex: Uberlândia - MG" value={farmDrawCity} onChange={(e) => setFarmDrawCity(e.target.value)} />
            </div>
          </div>

          {drawPoints.length >= 3 && (
            <p className="text-[10px] text-center" style={{ color: '#64748b' }}>
              Área: <span className="font-bold text-white">{polygonAreaHa(drawPoints).toFixed(1)} ha</span>
              {' '}· {drawPoints.length} pontos
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => void finishFarmDraw()} disabled={isSavingFarm || drawPoints.length < 3 || !farmDrawName.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
              {isSavingFarm ? 'Salvando...' : farmDrawTarget === 'new' ? 'Criar Fazenda' : 'Salvar Área'}
            </button>
            <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Painel de criação de bloco de pesquisa */}
      {drawMode === 'drawing_block' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto overflow-y-auto" style={panelStyle}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
              <span className="text-sm">🔬</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>Bloco de Pesquisa</p>
              {blockParentId && (
                <p className="text-[10px]" style={{ color: '#64748b' }}>
                  Talhão pai: {fields.find((f) => f.id === blockParentId)?.name}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Nome do Bloco</label>
              <input className={inputCls} placeholder="Ex: Bloco A" value={blockName} onChange={(e) => setBlockName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Nº do Bloco</label>
              <input type="number" min="1" className={inputCls} placeholder="1" value={blockNumero} onChange={(e) => setBlockNumero(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Material / Tratamento</label>
            <input className={inputCls} placeholder="Ex: Variedade NK 7059 + 200 kg/ha NPK" value={blockTratamento} onChange={(e) => setBlockTratamento(e.target.value)} />
          </div>

          {drawPoints.length >= 3 && (
            <p className="text-[10px] text-center" style={{ color: '#64748b' }}>
              Área: <span className="font-bold text-white">{polygonAreaHa(drawPoints).toFixed(4)} ha</span>
              {' '}· {drawPoints.length} pontos
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={finishBlock} disabled={isSaving || drawPoints.length < 3}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
              style={{ background: '#34d399', color: '#051a12' }}>
              {isSaving ? 'Salvando...' : 'Salvar Bloco'}
            </button>
            <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              Cancelar
            </button>
          </div>

          <p className="text-[9px] text-center" style={{ color: '#334155' }}>
            Após salvar, adicione quantos blocos precisar no mesmo talhão
          </p>
        </div>
      )}

      {/* Painel de edição de talhão */}
      {editingField && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto overflow-y-auto" style={panelStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Editar Talhão</p>
              <p className="text-[11px] text-white font-semibold mt-0.5">{editingField.name}</p>
            </div>
            <button onClick={cancelEdit} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all" style={{ color: '#64748b' }}>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Identificação */}
          <div>
            <label className={labelCls}>Nome do Talhão</label>
            <input className={inputCls} value={editForm.name} onChange={(e) => handleEditFormChange('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Cultura</label>
              <input className={inputCls} placeholder="Ex: Soja" value={editForm.cultura} onChange={(e) => handleEditFormChange('cultura', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Variedade</label>
              <input className={inputCls} placeholder="Ex: NK 7059" value={editForm.variedade} onChange={(e) => handleEditFormChange('variedade', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Data de Plantio</label>
            <input type="date" className={inputCls} value={editForm.dataPlantio} onChange={(e) => handleEditFormChange('dataPlantio', e.target.value)} />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>Detalhes Agronômicos</p>
            <CamposAgronomicos form={editForm} onChange={handleEditFormChange} />
          </div>

          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={isSavingEdit}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: '#60a5fa' }}>
              {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button onClick={cancelEdit} className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Nova Fazenda ──────────────────────────────────────────────── */}
      {showNewFarmModal && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center pointer-events-auto"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewFarmModal(false); setNewFarmName(''); setNewFarmCity(''); } }}>
          <div className="flex flex-col gap-4 rounded-2xl px-6 py-5 w-full max-w-md mx-4"
            style={{ background: 'rgba(8,8,9,0.98)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(20px)' }}>

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="material-symbols-outlined text-base text-white">add_home</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Nova Fazenda</p>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>Identificação da propriedade</p>
                </div>
              </div>
              <button onClick={() => { setShowNewFarmModal(false); setNewFarmName(''); setNewFarmCity(''); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all" style={{ color: '#64748b' }}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Campos */}
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Nome da Fazenda *</label>
                <input
                  className={inputCls}
                  placeholder="Ex: Fazenda Santa Rosa"
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newFarmName.trim()) void createNewFarm(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>Município / Estado</label>
                <input
                  className={inputCls}
                  placeholder="Ex: Uberlândia - MG"
                  value={newFarmCity}
                  onChange={(e) => setNewFarmCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newFarmName.trim()) void createNewFarm(); }}
                />
                <p className="text-[10px] mt-1.5" style={{ color: '#475569' }}>
                  O mapa será centralizado automaticamente na cidade informada.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5" style={{ color: '#64748b' }}>info</span>
              <p className="text-[10px] leading-relaxed" style={{ color: '#64748b' }}>
                A área da fazenda é opcional e pode ser definida depois pelo botão <strong className="text-slate-300">"Definir Área"</strong> no mapa.
              </p>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={() => void createNewFarm()}
                disabled={isCreatingFarm || !newFarmName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: '#ec5b13' }}>
                {isCreatingFarm
                  ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Criando...</>
                  : <><span className="material-symbols-outlined text-sm">check</span>Salvar Fazenda</>}
              </button>
              <button onClick={() => { setShowNewFarmModal(false); setNewFarmName(''); setNewFarmCity(''); }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
