// src/pages/Images.tsx — Monitor de Imagens de Satélite por Talhão
// Layout: sidebar com lista de talhões + viewer principal com timeline de datas
// Imagens servidas do Supabase Storage (cache) — zero custo de API externa

import { useState, useEffect, useCallback, useRef } from 'react';
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
  provider: string | null;
  bytes_size: number | null;
  image_path: string | null;
}

// ── Config visual por fonte e modo ────────────────────────────────────────────
const SRC_INFO: Record<string, { label: string; color: string }> = {
  s2: { label: 'Sentinel-2', color: '#60a5fa' },
  s1: { label: 'Sentinel-1', color: '#a78bfa' },
  up42: { label: 'Up42',      color: '#34d399' },
};

const MODE_LABEL: Record<string, string> = {
  truecolor: 'RGB', ndvi: 'NDVI', ndre: 'NDRE',
  evi: 'EVI', ndmi: 'NDMI', sar: 'SAR',
  falsecolor: 'Falsa Cor', agriculture: 'Agro',
};

const MODE_COLOR: Record<string, string> = {
  ndvi: '#22c55e', ndre: '#a855f7', evi: '#10b981',
  ndmi: '#06b6d4', truecolor: '#60a5fa', sar: '#a78bfa',
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s.slice(0, 10); }
}

function fmtDateShort(s: string | null) {
  if (!s) return '—';
  try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
  catch { return s.slice(0, 10); }
}

function isoDate(s: string | null) {
  if (!s) return '';
  return s.slice(0, 10);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Images() {
  const { fields, farms, activeFieldId, setActiveField } = useAppStore();

  // Talhão selecionado no sidebar
  const [selectedFieldId, setSelectedFieldId] = useState<string>(activeFieldId ?? fields[0]?.id ?? '');

  // Artefatos do talhão selecionado
  const [artifacts, setArtifacts] = useState<SatArtifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  // Artefato exibido no viewer (por padrão o mais recente NDVI)
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  // URL da imagem exibida no viewer
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const prevViewerUrlRef = useRef<string | null>(null);

  // Filtro de modo
  const [modeFilter, setModeFilter] = useState<string>('all');

  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;

  // Sync com talhão ativo do store
  useEffect(() => {
    if (activeFieldId && activeFieldId !== selectedFieldId) setSelectedFieldId(activeFieldId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

  // Carrega histórico quando muda o talhão
  const loadArtifacts = useCallback(async (fieldId: string) => {
    if (!fieldId) return;
    setLoadingArtifacts(true);
    setArtifacts([]);
    setActiveArtifactId(null);
    setViewerUrl(null);
    setViewerError(null);
    try {
      const headers = await buildAuthHeaders();
      const resp = await fetch(`${API_URL}/api/fields/${fieldId}/satellite-history?limit=200`, { headers });
      if (!resp.ok) throw new Error();
      const data = await resp.json() as { history?: SatArtifact[] };
      const list = (data.history ?? []).sort((a, b) =>
        (b.scene_date ?? b.generated_at).localeCompare(a.scene_date ?? a.generated_at)
      );
      setArtifacts(list);
      // Auto-carrega o NDVI mais recente
      const ndvi = list.find(a => a.mode === 'ndvi') ?? list[0] ?? null;
      if (ndvi) setActiveArtifactId(ndvi.id);
    } catch { /* silencioso */ }
    setLoadingArtifacts(false);
  }, []);

  useEffect(() => {
    if (selectedFieldId) void loadArtifacts(selectedFieldId);
  }, [selectedFieldId, loadArtifacts]);

  // Carrega imagem do artefato selecionado
  useEffect(() => {
    if (!activeArtifactId) return;
    let cancelled = false;
    setViewerLoading(true);
    setViewerError(null);
    setViewerUrl(null);

    buildAuthHeaders()
      .then(headers => fetch(`${API_URL}/api/satellite-artifacts/${activeArtifactId}/image`, { headers }))
      .then(async resp => {
        if (cancelled) return;
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        // Revoga URL anterior
        if (prevViewerUrlRef.current) { URL.revokeObjectURL(prevViewerUrlRef.current); }
        const url = URL.createObjectURL(blob);
        prevViewerUrlRef.current = url;
        setViewerUrl(url);
      })
      .catch(e => { if (!cancelled) setViewerError(e.message ?? 'Erro ao carregar'); })
      .finally(() => { if (!cancelled) setViewerLoading(false); });

    return () => { cancelled = true; };
  }, [activeArtifactId]);

  useEffect(() => () => {
    if (prevViewerUrlRef.current) URL.revokeObjectURL(prevViewerUrlRef.current);
  }, []);

  // Artefato ativo
  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) ?? null;

  // Filtro de modo
  const filtered = modeFilter === 'all' ? artifacts : artifacts.filter(a => a.mode === modeFilter);
  const modes = [...new Set(artifacts.map(a => a.mode))];

  // Talhão selecionado: navegar anterior/próximo
  const filteredIdx = filtered.findIndex(a => a.id === activeArtifactId);
  const canPrev = filteredIdx > 0;
  const canNext = filteredIdx < filtered.length - 1 && filteredIdx >= 0;

  function handleSelectField(id: string) {
    setSelectedFieldId(id);
    setActiveField(id);
    setModeFilter('all');
  }

  const srcInfo = activeArtifact ? (SRC_INFO[activeArtifact.source] ?? { label: activeArtifact.source, color: '#94a3b8' }) : null;
  const modeColor = activeArtifact ? (MODE_COLOR[activeArtifact.mode] ?? '#94a3b8') : '#94a3b8';

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar: lista de talhões ─────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r overflow-y-auto scrollbar-thin"
        style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>

        <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>satellite_alt</span>
            <h1 className="text-sm font-black text-white">Imagens</h1>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>Satélite por talhão</p>
        </div>

        <div className="p-2 flex flex-col gap-0.5">
          {farms.map(farm => (
            <div key={farm.id}>
              <p className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--muted)' }}>
                {farm.name}
              </p>
              {farm.fields.map(field => {
                const isActive = field.id === selectedFieldId;
                return (
                  <button key={field.id}
                    onClick={() => handleSelectField(field.id!)}
                    className="w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    style={isActive
                      ? { background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.35)' }
                      : { background: 'transparent', border: '1px solid transparent' }}>
                    <span className="material-symbols-outlined text-base flex-shrink-0"
                      style={{ color: isActive ? 'var(--primary)' : '#475569' }}>
                      crop_square
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate"
                        style={{ color: isActive ? 'white' : 'var(--text, #e2e8f0)' }}>
                        {field.name}
                      </p>
                      <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>
                        {field.areaHa ? `${field.areaHa} ha` : '—'} · {field.crop_type ?? 'sem cultura'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-[11px] px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
              Nenhum talhão cadastrado
            </p>
          )}
        </div>
      </aside>

      {/* ── Área principal ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {!selectedField ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>satellite_alt</span>
            <p className="text-sm font-bold text-white">Selecione um talhão</p>
          </div>
        ) : (
          <>
            {/* Header do talhão */}
            <div className="flex-shrink-0 px-5 py-3 border-b flex items-center gap-3 flex-wrap"
              style={{ background: 'var(--sidebar)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>crop_square</span>
                <div>
                  <h2 className="text-sm font-black text-white">{selectedField.name}</h2>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {selectedField.areaHa ? `${selectedField.areaHa} ha` : '—'}
                    {selectedField.crop_type ? ` · ${selectedField.crop_type}` : ''}
                    {' · '}{artifacts.length} imagens armazenadas
                  </p>
                </div>
              </div>

              {/* Filtro de modo */}
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                {['all', ...modes].map(m => {
                  const label = m === 'all' ? 'Todos' : (MODE_LABEL[m] ?? m.toUpperCase());
                  const color = m === 'all' ? '#94a3b8' : (MODE_COLOR[m] ?? '#94a3b8');
                  return (
                    <button key={m} onClick={() => setModeFilter(m)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                      style={modeFilter === m
                        ? { background: `${color}20`, color }
                        : { color: 'var(--muted)' }}>
                      {label}
                    </button>
                  );
                })}
              </div>

              <button onClick={() => void loadArtifacts(selectedFieldId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            </div>

            {loadingArtifacts ? (
              <div className="flex-1 flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando imagens…</p>
              </div>
            ) : filtered.length === 0 ? (
              /* ── Estado vazio ── */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(236,91,19,0.1)' }}>
                  <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--primary)' }}>satellite_alt</span>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white mb-1">Nenhuma imagem gerada ainda</p>
                  <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--muted)' }}>
                    Acesse <strong className="text-white">Mapas Agronômicos</strong>, selecione uma cena de satélite
                    e carregue a imagem. Ela será salva automaticamente aqui.
                  </p>
                </div>
                <a href="/app/maps"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'var(--primary)' }}>
                  <span className="material-symbols-outlined text-base">map</span>
                  Ir para Mapas Agronômicos
                </a>
              </div>
            ) : (
              /* ── Viewer + timeline ── */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {/* ── Viewer principal ── */}
                <div className="flex-1 relative min-h-0 flex items-center justify-center"
                  style={{ background: '#0a0a0c' }}>

                  {viewerLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10"
                      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                        <p className="text-xs text-white">Carregando imagem…</p>
                      </div>
                    </div>
                  )}

                  {viewerError && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-3xl" style={{ color: '#f87171' }}>broken_image</span>
                      <p className="text-sm" style={{ color: '#f87171' }}>{viewerError}</p>
                    </div>
                  )}

                  {viewerUrl && !viewerError && (
                    <img
                      src={viewerUrl}
                      alt={`${activeArtifact?.mode} ${activeArtifact?.scene_date}`}
                      className="max-w-full max-h-full object-contain"
                      style={{ display: 'block' }}
                    />
                  )}

                  {!viewerUrl && !viewerLoading && !viewerError && (
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>image</span>
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>Selecione uma data abaixo</p>
                    </div>
                  )}

                  {/* Info overlay da imagem ativa */}
                  {activeArtifact && !viewerLoading && (
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl z-10"
                      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="text-[11px] font-black px-1.5 py-0.5 rounded"
                        style={{ background: modeColor + '30', color: modeColor }}>
                        {MODE_LABEL[activeArtifact.mode] ?? activeArtifact.mode.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-semibold text-white">
                        {fmtDate(activeArtifact.scene_date ?? activeArtifact.generated_at)}
                      </span>
                      {srcInfo && (
                        <span className="text-[10px]" style={{ color: srcInfo.color }}>{srcInfo.label}</span>
                      )}
                      {activeArtifact.cloud_coverage != null && (
                        <span className="text-[10px]" style={{ color: '#94a3b8' }}>
                          ☁ {activeArtifact.cloud_coverage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Navegação prev/next */}
                  {filtered.length > 1 && (
                    <>
                      <button
                        onClick={() => canPrev && setActiveArtifactId(filtered[filteredIdx - 1].id)}
                        disabled={!canPrev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="material-symbols-outlined text-lg text-white">chevron_left</span>
                      </button>
                      <button
                        onClick={() => canNext && setActiveArtifactId(filtered[filteredIdx + 1].id)}
                        disabled={!canNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="material-symbols-outlined text-lg text-white">chevron_right</span>
                      </button>
                    </>
                  )}

                  {/* Contador */}
                  {filtered.length > 0 && filteredIdx >= 0 && (
                    <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#94a3b8', backdropFilter: 'blur(8px)' }}>
                      {filteredIdx + 1} / {filtered.length}
                    </div>
                  )}
                </div>

                {/* ── Timeline de datas ── */}
                <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}>
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin px-3 py-2.5">
                    {filtered.map(artifact => {
                      const isActive = artifact.id === activeArtifactId;
                      const mColor = MODE_COLOR[artifact.mode] ?? '#94a3b8';
                      const src = SRC_INFO[artifact.source] ?? { color: '#94a3b8' };
                      return (
                        <button
                          key={artifact.id}
                          onClick={() => setActiveArtifactId(artifact.id)}
                          className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
                          style={isActive
                            ? { background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.4)' }
                            : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                          {/* Indicador de modo */}
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                            style={{ background: mColor + '20', color: mColor }}>
                            {MODE_LABEL[artifact.mode] ?? artifact.mode.toUpperCase()}
                          </span>
                          {/* Data */}
                          <p className="text-[11px] font-bold whitespace-nowrap"
                            style={{ color: isActive ? 'white' : 'var(--text, #e2e8f0)' }}>
                            {fmtDateShort(isoDate(artifact.scene_date ?? artifact.generated_at))}
                          </p>
                          {/* Fonte */}
                          <span className="text-[8px] font-semibold" style={{ color: src.color }}>
                            {artifact.source.toUpperCase()}
                          </span>
                          {/* Nuvens */}
                          {artifact.cloud_coverage != null && (
                            <span className="text-[8px]" style={{ color: '#475569' }}>
                              ☁{artifact.cloud_coverage.toFixed(0)}%
                            </span>
                          )}
                          {isActive && (
                            <div className="w-1 h-1 rounded-full" style={{ background: 'var(--primary)' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Rodapé */}
                  <div className="px-4 py-1.5 border-t flex items-center justify-between"
                    style={{ borderColor: 'var(--border)' }}>
                    <p className="text-[9px]" style={{ color: '#334155' }}>
                      💾 Imagens armazenadas no Supabase Storage · sem custo de regeneração
                    </p>
                    {activeArtifact?.bytes_size && (
                      <p className="text-[9px]" style={{ color: '#334155' }}>
                        {(activeArtifact.bytes_size / 1024).toFixed(0)} KB
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
