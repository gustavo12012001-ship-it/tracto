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

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── NASA GIBS date: use a recent stable date (D-10) to avoid broken tiles ────
const gibsDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10); // e.g. "2024-03-21"
})();

// ── Map Click Handler ─────────────────────────────────────────────────────────
type DrawMode = 'none' | 'drawing';

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ── Map Controller (Auto-centering & Status) ───────────────────────────────
function MapController() {
  const map = useMap();
  const { currentLocation, locationStatus, fields, activeFieldId, activeFieldFocusToken } = useAppStore();
  const hasCenteredInitial = useRef(false);
  const previousActiveFieldId = useRef<string | null>(null);
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

    if (!activeFieldId) {
      previousActiveFieldId.current = null;
      return;
    }

    if (previousActiveFieldId.current === activeFieldId && !hasManualFocusRequest) return;

    const field = fields.find((f) => f.id === activeFieldId);
    if (!field) return;

    map.flyTo([field.lat, field.lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.9,
    });
    previousActiveFieldId.current = activeFieldId;
  }, [activeFieldId, activeFieldFocusToken, fields, map]);

  return null;
}
const QUICK_CROPS = ['Soja', 'Milho', 'Sorgo', 'Algodão', 'Trigo', 'Cana-de-açúcar', 'Café'] as const;
const OTHER_CROP_VALUE = '__other__';

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

// ── Main Component ────────────────────────────────────────────────────────────
export default function FieldMap() {
  const {
    currentLocation,
    locationStatus,
    fields,
    createField,
    removeField,
    setActiveField,
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

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng];

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (drawMode !== 'drawing') return;
    setDrawPoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
  }, [drawMode]);

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
        {/* ── Base satellite layer (always visible) ── */}
        <TileLayer
          attribution="&copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
        />
        {/* Hybrid labels */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
          opacity={0.6}
        />

        {/* ── NDVI layer (NASA GIBS — MODIS Terra 8-day) ── */}
        {activeMapLayer === 'ndvi' && (
          <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`}
            attribution="NASA GIBS · MODIS Terra NDVI"
            maxZoom={9}
            opacity={0.85}
          />
        )}

        {/* ── Moisture layer (NASA GIBS — MODIS Terra Land Surface Temp as proxy) ── */}
        {activeMapLayer === 'moisture' && (
          <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.png`}
            attribution="NASA GIBS · MODIS Terra LST"
            maxZoom={9}
            opacity={0.75}
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Current location marker */}
        {currentLocation && locationStatus === 'precise' && !fields.some((s) => s.lat === currentLocation.lat) && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}>
            <Popup>📍 Sua localização atual</Popup>
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
                fillOpacity: isActive ? 0.42 : 0.25,
                weight: isActive ? 3 : 2,
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
        <ZoomControls />
      </MapContainer>

      {/* ── Overlays (outside MapContainer) ── */}

      {/* Layer Switcher — Visible Control */}
      {drawMode === 'none' && (
        <div
          className="absolute top-4 left-4 z-[500] flex flex-col gap-1.5 pointer-events-auto"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest px-2" style={{ color: '#64748b' }}>Camadas</p>
          <div className="flex flex-col gap-1">
            {[
              { id: 'satellite' as const, label: '🛰 Satélite', icon: 'satellite' },
              { id: 'ndvi' as const, label: 'NDVI', icon: 'eco' },
              { id: 'moisture' as const, label: 'Umidade', icon: 'water_drop' },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => useAppStore.getState().setMapLayer(id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-left flex items-center gap-2"
                style={{
                  background: activeMapLayer === id ? 'rgba(236,91,19,0.2)' : 'rgba(255,255,255,0.04)',
                  border: activeMapLayer === id ? '1px solid #ec5b13' : '1px solid rgba(255,255,255,0.08)',
                  color: activeMapLayer === id ? '#ec5b13' : '#94a3b8',
                }}
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {activeMapLayer === 'ndvi' && (
            <div className="mt-1.5 px-2 pb-1 text-[9px]" style={{ color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
              <p className="font-semibold mb-0.5">📅 Data: {gibsDate.split('-').reverse().join('/')}</p>
              <p className="text-[8px]" style={{ color: '#475569' }}>Imagem composta (D-10)</p>
            </div>
          )}
        </div>
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

      {/* Fields legend */}
      {drawMode === 'none' && fields.length > 0 && (
        <div
          className="absolute bottom-4 left-4 z-[500] p-3 rounded-xl pointer-events-none"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', maxHeight: '200px', overflowY: 'auto' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Talhões</p>
          <div className="space-y-1">
            {fields.map((loc, i) => (
              <div key={loc.id} className="flex items-center gap-2 text-xs text-white">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: FIELD_COLORS[i % FIELD_COLORS.length] }} />
                <span style={{ color: loc.id && loc.id === activeFieldId ? '#f97316' : '#ffffff', fontWeight: loc.id && loc.id === activeFieldId ? 700 : 500 }}>
                  {loc.name ?? `Talhão ${i + 1}`}{loc.id && loc.id === activeFieldId ? ' (ativo)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NDVI legend */}
      {activeMapLayer === 'ndvi' && (
        <div
          className="absolute bottom-4 right-4 z-[500] p-3 rounded-xl pointer-events-none text-[10px]"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', maxWidth: '220px' }}
        >
          <p className="font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>📊 NDVI — NASA GIBS</p>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-24 h-3 rounded-full" style={{ background: 'linear-gradient(to right, #a52a2a, #ffff00, #00aa00)' }} />
          </div>
          <div className="flex justify-between text-[9px] mb-1.5 text-slate-500">
            <span>Baixo NDVI</span><span style={{ color: '#8b5cf6' }}>Alto NDVI</span>
          </div>
          <div className="text-[9px] p-1.5 rounded" style={{ background: 'rgba(236,91,19,0.1)', border: '1px solid rgba(236,91,19,0.2)', color: '#f97316' }}>
            <p className="font-semibold mb-0.5">📅 Data: {gibsDate.split('-').reverse().join('/')}</p>
            <p className="text-[8px]" style={{ color: '#cbd5e1' }}>Imagem composta (D-10, não é ao vivo)</p>
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
