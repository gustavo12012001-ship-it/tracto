// src/pages/Images.tsx — Galeria de Imagens de Satélite
// Exibe todas as imagens geradas (cacheadas) organizadas por data
// Cada data é uma linha; dentro cada card mostra modo e fonte

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { API_URL, buildAuthHeaders } from '../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SatArtifact {
  id: string;
  source: string;
  mode: string;
  scene_id: string | null;
  scene_date: string | null;
  cloud_coverage: number | null;
  generated_at: string;
  updated_at: string | null;
  provider: string | null;
  bytes_size: number | null;
  image_path: string | null;
}

interface DateGroup {
  date: string;          // ISO date string YYYY-MM-DD
  dateBR: string;        // formatada pt-BR
  items: SatArtifact[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SRC_INFO: Record<string, { label: string; color: string; short: string }> = {
  s2: { label: 'Sentinel-2', color: '#60a5fa', short: 'S2' },
  s1: { label: 'Sentinel-1', color: '#a78bfa', short: 'S1' },
  up42: { label: 'Up42', color: '#34d399', short: 'U42' },
};

const MODE_LABEL: Record<string, string> = {
  truecolor: 'RGB',
  ndvi: 'NDVI',
  ndre: 'NDRE',
  evi: 'EVI',
  ndmi: 'NDMI',
  falsecolor: 'Falsa Cor',
  agriculture: 'Agricultura',
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return s; }
}

function isoDate(s: string | null): string {
  if (!s) return '0000-00-00';
  try { return s.slice(0, 10); } catch { return '0000-00-00'; }
}

function groupByDate(items: SatArtifact[]): DateGroup[] {
  const map = new Map<string, SatArtifact[]>();
  for (const item of items) {
    const key = isoDate(item.scene_date ?? item.generated_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // mais recente primeiro
    .map(([date, group]) => ({
      date,
      dateBR: fmtDate(date),
      items: group,
    }));
}

// ── Card de imagem ────────────────────────────────────────────────────────────

function ImageCard({
  artifact,
  fieldName,
  onLoadToMap,
}: {
  artifact: SatArtifact;
  fieldName: string;
  onLoadToMap: (id: string) => void;
}) {
  const src = SRC_INFO[artifact.source] ?? { label: artifact.source, color: '#94a3b8', short: artifact.source.toUpperCase() };
  const modeLabel = MODE_LABEL[artifact.mode] ?? artifact.mode.toUpperCase();
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  // Carrega preview da imagem do Storage (lazy)
  const loadPreview = useCallback(async () => {
    if (preview || previewLoading) return;
    setPreviewLoading(true);
    try {
      const headers = await buildAuthHeaders();
      const resp = await fetch(`${API_URL}/api/satellite-artifacts/${artifact.id}/image`, { headers });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreview(url);
    } catch {
      /* imagem não disponível */
    }
    setPreviewLoading(false);
  }, [artifact.id, preview, previewLoading]);

  // Limpa object URL ao desmontar
  useEffect(() => {
    const url = previewUrlRef.current;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden flex-shrink-0 transition-all hover:scale-[1.02]"
      style={{
        width: 140,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      {/* Thumbnail / Preview */}
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{ height: 90, background: `${src.color}0d` }}
        onClick={loadPreview}
        title="Clique para carregar preview"
      >
        {preview ? (
          <img
            src={preview}
            alt={`${modeLabel} ${artifact.scene_date}`}
            className="w-full h-full object-cover"
          />
        ) : previewLoading ? (
          <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-2xl" style={{ color: src.color }}>satellite_alt</span>
            <p className="text-[9px]" style={{ color: 'var(--muted)' }}>Ver preview</p>
          </div>
        )}

        {/* Badges sobrepostos */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: `${src.color}cc`, color: '#fff' }}>
            {src.short}
          </span>
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#e2e8f0' }}>
            {modeLabel}
          </span>
        </div>
        {artifact.cloud_coverage != null && (
          <div className="absolute top-1.5 right-1.5">
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#94a3b8' }}>
              ☁ {artifact.cloud_coverage.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-[10px] font-bold truncate" style={{ color: 'var(--text, #e2e8f0)' }}>{fieldName}</p>
        {artifact.bytes_size && (
          <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{(artifact.bytes_size / 1024).toFixed(0)} KB</p>
        )}
        <button
          onClick={() => onLoadToMap(artifact.id)}
          className="mt-1.5 w-full py-1 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition-all hover:opacity-80"
          style={{ background: `${src.color}20`, color: src.color, border: `1px solid ${src.color}30` }}
          title="Carregar no mapa sem custo de API"
        >
          <span className="material-symbols-outlined text-xs">map</span>
          Ver no mapa
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Images() {
  const navigate = useNavigate();
  const { fields, activeFieldId } = useAppStore();

  const [selectedFieldId, setSelectedFieldId] = useState<string>(activeFieldId ?? fields[0]?.id ?? '');
  const [artifacts, setArtifacts] = useState<SatArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [srcFilter, setSrcFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');

  const selectedField = fields.find(f => f.id === selectedFieldId);

  // Carrega artefatos do talhão selecionado
  const loadArtifacts = useCallback(async (fieldId: string) => {
    if (!fieldId) return;
    setLoading(true);
    setArtifacts([]);
    try {
      const headers = await buildAuthHeaders();
      const resp = await fetch(`${API_URL}/api/fields/${fieldId}/satellite-history?limit=200`, { headers });
      if (!resp.ok) throw new Error();
      const data = await resp.json() as { history?: SatArtifact[] };
      setArtifacts(data.history ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedFieldId) void loadArtifacts(selectedFieldId);
  }, [selectedFieldId, loadArtifacts]);

  // Recarrega ao mudar talhão ativo
  useEffect(() => {
    if (activeFieldId && activeFieldId !== selectedFieldId) {
      setSelectedFieldId(activeFieldId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

  // Navega para mapas e passa o ID do artefato via sessionStorage
  function handleLoadToMap(artifactId: string) {
    sessionStorage.setItem('tracto-load-artifact', artifactId);
    navigate('/app/maps');
  }

  // Filtros
  const filtered = artifacts.filter(a => {
    if (srcFilter !== 'all' && a.source !== srcFilter) return false;
    if (modeFilter !== 'all' && a.mode !== modeFilter) return false;
    return true;
  });

  const groups = groupByDate(filtered);
  const sources = [...new Set(artifacts.map(a => a.source))];
  const modes = [...new Set(artifacts.map(a => a.mode))];

  const totalKB = artifacts.reduce((acc, a) => acc + (a.bytes_size ?? 0), 0) / 1024;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b flex items-center gap-4 flex-wrap"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>photo_library</span>
            <h1 className="text-sm font-black text-white">Galeria de Imagens</h1>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
            {artifacts.length} imagens armazenadas · {totalKB.toFixed(0)} KB total · agrupadas por data de cena
          </p>
        </div>

        {/* Seletor de talhão */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <select
            value={selectedFieldId}
            onChange={e => setSelectedFieldId(e.target.value)}
            className="bg-transparent border rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
          >
            {fields.map(f => (
              <option key={f.id} value={f.id ?? ''} style={{ background: '#0d0d0f' }}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedFieldId && void loadArtifacts(selectedFieldId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            title="Atualizar lista"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2 border-b flex items-center gap-2 flex-wrap"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Fonte:</span>
        {['all', ...sources].map(src => {
          const info = src === 'all' ? { label: 'Todas', color: '#94a3b8' } : (SRC_INFO[src] ?? { label: src, color: '#94a3b8' });
          const cnt = src === 'all' ? artifacts.length : artifacts.filter(a => a.source === src).length;
          return (
            <button key={src} onClick={() => setSrcFilter(src)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={srcFilter === src
                ? { background: `${info.color}20`, color: info.color, border: `1px solid ${info.color}40` }
                : { color: 'var(--muted)', border: '1px solid transparent' }}>
              {info.label} ({cnt})
            </button>
          );
        })}

        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Modo:</span>
        {['all', ...modes].map(mode => {
          const label = mode === 'all' ? 'Todos' : (MODE_LABEL[mode] ?? mode.toUpperCase());
          return (
            <button key={mode} onClick={() => setModeFilter(mode)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={modeFilter === mode
                ? { background: 'rgba(236,91,19,0.15)', color: 'var(--primary)', border: '1px solid rgba(236,91,19,0.3)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Sem talhão */}
        {!selectedFieldId && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>satellite_alt</span>
            <p className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>Selecione um talhão</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Vá em Mapa & Talhões para adicionar um talhão</p>
          </div>
        )}

        {/* Loading */}
        {loading && selectedFieldId && (
          <div className="flex items-center justify-center h-40 gap-3">
            <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando imagens…</p>
          </div>
        )}

        {/* Sem imagens */}
        {!loading && selectedFieldId && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>photo_library</span>
            <p className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>
              {artifacts.length === 0 ? 'Nenhuma imagem gerada ainda' : 'Nenhuma imagem com esses filtros'}
            </p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--muted)' }}>
              {artifacts.length === 0
                ? 'Acesse Mapas Agronômicos, selecione uma cena de satélite e carregue a imagem. Ela será salva automaticamente aqui.'
                : 'Tente remover os filtros para ver mais imagens.'}
            </p>
            {artifacts.length === 0 && (
              <button onClick={() => navigate('/app/maps')}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-80"
                style={{ background: 'var(--primary)' }}>
                <span className="material-symbols-outlined text-sm">satellite_alt</span>
                Ir para Mapas Agronômicos
              </button>
            )}
          </div>
        )}

        {/* Grupos por data */}
        {!loading && groups.map(group => (
          <div key={group.date} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
            {/* Cabeçalho da data */}
            <div className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: 'var(--primary)' }}>calendar_today</span>
              <div>
                <p className="text-xs font-black text-white">{group.dateBR}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {group.items.length} {group.items.length === 1 ? 'imagem' : 'imagens'}
                </p>
              </div>
              {/* Badges de fontes presentes nessa data */}
              <div className="ml-auto flex gap-1">
                {[...new Set(group.items.map(i => i.source))].map(s => {
                  const inf = SRC_INFO[s] ?? { label: s, color: '#94a3b8', short: s };
                  return (
                    <span key={s} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${inf.color}20`, color: inf.color }}>
                      {inf.short}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Row de cards */}
            <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-thin">
              {group.items.map(artifact => (
                <ImageCard
                  key={artifact.id}
                  artifact={artifact}
                  fieldName={selectedField?.name ?? '—'}
                  onLoadToMap={handleLoadToMap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
