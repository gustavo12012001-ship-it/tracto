// src/pages/Caderno.tsx — Caderno de Campo Completo
// Abas: Identificação | Diário | Fitossanitário | Aplicações | Solo | Safras | Calculadora

import { useState, useEffect, useCallback } from 'react';
import FieldLog from './FieldLog';
import SoilData from './SoilData';
import Seasons from './Seasons';
import Calculator from './Calculator';
import useAppStore from '../store/useAppStore';
import { analyzeFieldDocument, apiFetch, type FieldDocumentAnalysisResult } from '../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type CadernoTab = 'identificacao' | 'diario' | 'fitossanitario' | 'aplicacoes' | 'colheita' | 'solo' | 'safras' | 'calculadora';

interface NotebookEvent {
  id: string;
  category: string;
  title?: string;
  occurred_at: string;
  data?: Record<string, unknown>;
  ai_analysis?: string;
  created_at: string;
}

interface ImportedNotebookFile {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readNotebookFile(file: File): Promise<ImportedNotebookFile> {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return Promise.reject(new Error('Envie um PDF ou imagem nos formatos JPG, PNG ou WEBP.'));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error('Arquivo muito grande. Envie um anexo de ate 10 MB.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const [, base64 = ''] = dataUrl.split(',');
      resolve({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64,
        previewUrl: file.type.startsWith('image/') ? dataUrl : undefined,
      });
    };
    reader.readAsDataURL(file);
  });
}

const TABS: { id: CadernoTab; label: string; icon: string }[] = [
  { id: 'identificacao',  label: 'Identificação',    icon: 'info'         },
  { id: 'diario',         label: 'Diário de Campo',  icon: 'menu_book'    },
  { id: 'fitossanitario', label: 'Fitossanitário',   icon: 'bug_report'   },
  { id: 'aplicacoes',     label: 'Aplicações',       icon: 'science'      },
  { id: 'colheita',       label: 'Colheita',         icon: 'agriculture'  },
  { id: 'solo',           label: 'Solo & Adubação',  icon: 'layers'       },
  { id: 'safras',         label: 'Safras',           icon: 'grass'        },
  { id: 'calculadora',    label: 'Calculadora',      icon: 'calculate'    },
];

// Classes que usam CSS variables — adaptam automaticamente light/dark
const inputCls = 'tracto-input w-full rounded-lg px-3 py-2 text-xs focus:outline-none';
const selectCls = 'tracto-select w-full rounded-lg px-3 py-2 text-xs focus:outline-none appearance-none';
const labelCls = 'tracto-label text-[10px] mb-1 block';
const btnPrimary = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all text-white';

// Helper de delete de evento — usado em todas as sub-tabs
async function deleteNotebookEvent(eventId: string): Promise<boolean> {
  try {
    await apiFetch(`/api/notebook/${eventId}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.error('Erro ao deletar evento:', err);
    return false;
  }
}

// Componente reutilizável: botão de delete inline com confirmação
function DeleteEventButton({ eventId, onDeleted }: { eventId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            setDeleting(true);
            const ok = await deleteNotebookEvent(eventId);
            setDeleting(false);
            if (ok) onDeleted();
            else setConfirming(false);
          }}
          disabled={deleting}
          className="text-[10px] font-bold px-2 py-1 rounded transition-all"
          style={{ background: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}
          title="Confirmar exclusão"
        >
          {deleting ? '…' : 'Excluir'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-[10px] font-bold px-2 py-1 rounded transition-all"
          style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          title="Cancelar"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1 rounded transition-all hover:bg-red-500/10"
      title="Excluir registro"
    >
      <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>delete</span>
    </button>
  );
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return s; }
}

// ── Aba Identificação ─────────────────────────────────────────────────────────

function IdentificacaoTab() {
  const { fields, farms, activeFieldId } = useAppStore();
  const field = activeFieldId ? fields.find(f => f.id === activeFieldId) : null;
  const farm = field?.farm_id ? farms.find(f => f.id === field.farm_id) : null;

  if (!field) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: '#334155' }}>info</span>
          <p className="text-sm font-semibold" style={{ color: '#475569' }}>Selecione um talhão no mapa</p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>Os dados de identificação aparecerão aqui</p>
        </div>
      </div>
    );
  }

  const rows: [string, string][] = [
    ['Fazenda',      farm?.name ?? '—'],
    ['Talhão',       field.name ?? '—'],
    ['Área (ha)',    field.areaHa != null ? `${field.areaHa.toFixed(2)} ha` : '—'],
    ['Cultura',      field.cultura ?? '—'],
    ['Variedade',    field.variedade ?? '—'],
    ['Plantio',      field.dataPlantio ? fmtDate(field.dataPlantio) : '—'],
    ['Irrigação',    field.irrigacaoTipo ?? '—'],
    ['Solo',         field.texturaSolo ?? '—'],
    ['Cultura ant.', field.culturaAnterior ?? '—'],
    ['Rotação',      field.rotacaoCulturas ?? '—'],
    ['Coordenadas',  `${field.lat.toFixed(5)}, ${field.lng.toFixed(5)}`],
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 py-3" style={{ background: 'rgba(236,91,19,0.08)', borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-black text-white uppercase tracking-wider">📋 Ficha do Talhão</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center px-4 py-2.5 gap-4">
                <span className="text-[10px] font-bold w-28 flex-shrink-0" style={{ color: '#64748b' }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color: value === '—' ? '#334155' : 'var(--text)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Aba Fitossanitário ────────────────────────────────────────────────────────

type FitoCat = 'pest' | 'disease' | 'weed';

const FITO_TYPES: { id: FitoCat; label: string; icon: string; color: string }[] = [
  { id: 'pest',    label: 'Praga',           icon: 'bug_report',  color: '#f97316' },
  { id: 'disease', label: 'Doença',          icon: 'coronavirus', color: '#ef4444' },
  { id: 'weed',    label: 'Planta Daninha',  icon: 'grass',       color: '#84cc16' },
];

const INFESTATION_LEVELS = ['Baixo (<10%)', 'Médio (10–30%)', 'Alto (30–50%)', 'Severo (>50%)'];

function FitossanitarioTab() {
  const { fields, activeFieldId } = useAppStore();
  const field = activeFieldId ? fields.find(f => f.id === activeFieldId) : null;

  const [cat, setCat] = useState<FitoCat>('pest');
  const [form, setForm] = useState({
    name: '', scientific_name: '', incidence_pct: '', infestation_level: '',
    location: '', occurred_at: todayISO(), notes: '',
  });
  const [events, setEvents] = useState<NotebookEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!field?.id) return;
    setLoading(true);
    try {
      const cats = ['pest', 'disease', 'weed'];
      const results = await Promise.allSettled(
        cats.map(c => apiFetch(`/api/fields/${field.id}/notebook?category=${c}&limit=50`))
      );
      const all: NotebookEvent[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...((r.value as { events?: NotebookEvent[] }).events ?? []));
      }
      all.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      setEvents(all);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [field?.id]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const handleSave = async () => {
    if (!field?.id || !form.name) return;
    setSaving(true);
    try {
      const key = cat === 'pest' ? 'pest_name' : cat === 'disease' ? 'disease_name' : 'species';
      await apiFetch(`/api/fields/${field.id}/notebook`, {
        method: 'POST',
        body: JSON.stringify({
          category: cat,
          title: `${FITO_TYPES.find(t => t.id === cat)?.label}: ${form.name}`,
          occurred_at: form.occurred_at,
          data: {
            [key]: form.name,
            scientific_name: form.scientific_name || undefined,
            incidence_pct: form.incidence_pct || undefined,
            infestation_level: form.infestation_level || undefined,
            location_in_field: form.location || undefined,
            notes: form.notes || undefined,
          },
        }),
      });
      setForm({ name: '', scientific_name: '', incidence_pct: '', infestation_level: '', location: '', occurred_at: todayISO(), notes: '' });
      await loadEvents();
    } catch { /* silencioso */ }
    setSaving(false);
  };

  if (!field) return <NoFieldSelected />;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tipo */}
      <div className="flex gap-2 p-4 pb-0">
        {FITO_TYPES.map(t => (
          <button key={t.id} onClick={() => setCat(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={cat === t.id
              ? { background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }
              : { color: '#475569', border: '1px solid var(--border)', background: 'transparent' }}>
            <span className="material-symbols-outlined text-sm">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="p-4 pb-2">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>{cat === 'weed' ? 'Espécie' : 'Nome comum'}</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Ex: Lagarta-do-cartucho" />
            </div>
            <div>
              <label className={labelCls}>Nome científico</label>
              <input className={inputCls} value={form.scientific_name} onChange={e => setForm(p => ({...p, scientific_name: e.target.value}))} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" className={inputCls} value={form.occurred_at} onChange={e => setForm(p => ({...p, occurred_at: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Incidência (%)</label>
              <input type="number" className={inputCls} value={form.incidence_pct} onChange={e => setForm(p => ({...p, incidence_pct: e.target.value}))} placeholder="0–100" />
            </div>
            <div>
              <label className={labelCls}>Nível de infestação</label>
              <select className={selectCls} value={form.infestation_level} onChange={e => setForm(p => ({...p, infestation_level: e.target.value}))}>
                <option value="">Selecione</option>
                {INFESTATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Local no talhão</label>
            <input className={inputCls} value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} placeholder="Ex: Terço inicial, bordadura N" />
          </div>
          <div className="mb-3">
            <label className={labelCls}>Observações</label>
            <textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Notas adicionais..." />
          </div>
          <button onClick={handleSave} disabled={saving || !form.name}
            className={btnPrimary}
            style={{ background: saving || !form.name ? 'rgba(236,91,19,0.3)' : 'var(--primary)', opacity: !form.name ? 0.5 : 1 }}>
            <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
            {saving ? 'Salvando...' : 'Registrar ocorrência'}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 pt-2 flex flex-col gap-2">
        {loading && <Spinner />}
        {!loading && events.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: '#334155' }}>Nenhuma ocorrência registrada.</p>
        )}
        {events.map(e => {
          const type = FITO_TYPES.find(t => t.id === e.category);
          return (
            <div key={e.id} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${type?.color ?? '#94a3b8'}20`, color: type?.color ?? '#94a3b8' }}>{type?.label}</span>
                <span className="text-[10px]" style={{ color: '#64748b' }}>{fmtDate(e.occurred_at)}</span>
                <div className="ml-auto">
                  <DeleteEventButton
                    eventId={e.id}
                    onDeleted={() => setEvents(prev => prev.filter(x => x.id !== e.id))}
                  />
                </div>
              </div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{e.title}</p>
              {e.data?.infestation_level != null && <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>Infestação: {String(e.data.infestation_level)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Aba Aplicações ────────────────────────────────────────────────────────────

const PURPOSE_OPTS = ['Herbicida', 'Fungicida', 'Inseticida', 'Acaricida', 'Regulador de crescimento', 'Micronutriente', 'Fertilizante foliar', 'Outro'];

function AplicacoesTab() {
  const { fields, activeFieldId } = useAppStore();
  const field = activeFieldId ? fields.find(f => f.id === activeFieldId) : null;

  const [type, setType] = useState<'application' | 'fertilization' | 'irrigation'>('application');
  const [form, setForm] = useState({
    product: '', commercial_name: '', active_ingredient: '', dose: '', volume: '',
    qty_per_ha: '', purpose: '', occurred_at: todayISO(), area_ha: '',
    notes: '',
  });
  const [events, setEvents] = useState<NotebookEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!field?.id) return;
    setLoading(true);
    try {
      const cats = ['application', 'fertilization', 'irrigation'];
      const results = await Promise.allSettled(
        cats.map(c => apiFetch(`/api/fields/${field.id}/notebook?category=${c}&limit=50`))
      );
      const all: NotebookEvent[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...((r.value as { events?: NotebookEvent[] }).events ?? []));
      }
      all.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      setEvents(all);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [field?.id]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const TYPE_LABELS: Record<string, string> = { application: 'Pulverização', fertilization: 'Adubação', irrigation: 'Irrigação' };
  const TYPE_COLORS: Record<string, string> = { application: '#f97316', fertilization: '#22c55e', irrigation: '#3b82f6' };

  const handleSave = async () => {
    if (!field?.id || !form.product) return;
    setSaving(true);
    try {
      await apiFetch(`/api/fields/${field.id}/notebook`, {
        method: 'POST',
        body: JSON.stringify({
          category: type,
          title: `${TYPE_LABELS[type]}: ${form.product}`,
          occurred_at: form.occurred_at,
          data: {
            product: form.product,
            commercial_name: form.commercial_name || undefined,
            active_ingredient: form.active_ingredient || undefined,
            dose_l_ha: form.dose || undefined,
            volume_L_ha: form.volume || undefined,
            qty_per_ha: form.qty_per_ha || undefined,
            purpose: form.purpose || undefined,
            area_ha: form.area_ha ? parseFloat(form.area_ha) : undefined,
            notes: form.notes || undefined,
          },
        }),
      });
      setForm({ product: '', commercial_name: '', active_ingredient: '', dose: '', volume: '', qty_per_ha: '', purpose: '', occurred_at: todayISO(), area_ha: '', notes: '' });
      await loadEvents();
    } catch { /* silencioso */ }
    setSaving(false);
  };

  if (!field) return <NoFieldSelected />;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex gap-2 p-4 pb-0">
        {(['application', 'fertilization', 'irrigation'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={type === t
              ? { background: `${TYPE_COLORS[t]}20`, color: TYPE_COLORS[t], border: `1px solid ${TYPE_COLORS[t]}40` }
              : { color: '#475569', border: '1px solid var(--border)', background: 'transparent' }}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="p-4 pb-2">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Produto / Insumo *</label>
              <input className={inputCls} value={form.product} onChange={e => setForm(p => ({...p, product: e.target.value}))} placeholder="Ex: Vertimec" />
            </div>
            <div>
              <label className={labelCls}>Nome comercial</label>
              <input className={inputCls} value={form.commercial_name} onChange={e => setForm(p => ({...p, commercial_name: e.target.value}))} />
            </div>
          </div>
          {type === 'application' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>Ingrediente ativo</label>
                  <input className={inputCls} value={form.active_ingredient} onChange={e => setForm(p => ({...p, active_ingredient: e.target.value}))} />
                </div>
                <div>
                  <label className={labelCls}>Finalidade</label>
                  <select className={selectCls} value={form.purpose} onChange={e => setForm(p => ({...p, purpose: e.target.value}))}>
                    <option value="">Selecione</option>
                    {PURPOSE_OPTS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className={labelCls}>Dose (L/ha ou kg/ha)</label>
                  <input className={inputCls} value={form.dose} onChange={e => setForm(p => ({...p, dose: e.target.value}))} />
                </div>
                <div>
                  <label className={labelCls}>Vol. calda (L/ha)</label>
                  <input className={inputCls} value={form.volume} onChange={e => setForm(p => ({...p, volume: e.target.value}))} />
                </div>
                <div>
                  <label className={labelCls}>Qtd/ha</label>
                  <input className={inputCls} value={form.qty_per_ha} onChange={e => setForm(p => ({...p, qty_per_ha: e.target.value}))} />
                </div>
              </div>
            </>
          )}
          {type === 'fertilization' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Dose (kg/ha)</label>
                <input className={inputCls} value={form.dose} onChange={e => setForm(p => ({...p, dose: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Formulação NPK</label>
                <input className={inputCls} value={form.qty_per_ha} onChange={e => setForm(p => ({...p, qty_per_ha: e.target.value}))} placeholder="Ex: 12-8-16" />
              </div>
            </div>
          )}
          {type === 'irrigation' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Duração (h)</label>
                <input className={inputCls} value={form.dose} onChange={e => setForm(p => ({...p, dose: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Lâmina (mm)</label>
                <input className={inputCls} value={form.volume} onChange={e => setForm(p => ({...p, volume: e.target.value}))} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" className={inputCls} value={form.occurred_at} onChange={e => setForm(p => ({...p, occurred_at: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Área aplicada (ha)</label>
              <input type="number" className={inputCls} value={form.area_ha} onChange={e => setForm(p => ({...p, area_ha: e.target.value}))} />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Observações</label>
            <textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
          </div>
          <button onClick={handleSave} disabled={saving || !form.product}
            className={btnPrimary}
            style={{ background: saving || !form.product ? 'rgba(236,91,19,0.3)' : 'var(--primary)', opacity: !form.product ? 0.5 : 1 }}>
            <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
            {saving ? 'Salvando...' : `Registrar ${TYPE_LABELS[type]}`}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-2 flex flex-col gap-2">
        {loading && <Spinner />}
        {!loading && events.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: '#334155' }}>Nenhuma aplicação registrada.</p>
        )}
        {events.map(e => (
          <div key={e.id} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${TYPE_COLORS[e.category] ?? '#94a3b8'}20`, color: TYPE_COLORS[e.category] ?? '#94a3b8' }}>
                {TYPE_LABELS[e.category] ?? e.category}
              </span>
              <span className="text-[10px]" style={{ color: '#64748b' }}>{fmtDate(e.occurred_at)}</span>
              <div className="ml-auto">
                <DeleteEventButton
                  eventId={e.id}
                  onDeleted={() => setEvents(prev => prev.filter(x => x.id !== e.id))}
                />
              </div>
            </div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{e.title}</p>
            {e.data?.dose_l_ha != null && <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>Dose: {String(e.data.dose_l_ha)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Aba Colheita ──────────────────────────────────────────────────────────────

function ColheitaTab() {
  const { fields, activeFieldId } = useAppStore();
  const field = activeFieldId ? fields.find(f => f.id === activeFieldId) : null;

  const [form, setForm] = useState({
    start_date: todayISO(), end_date: '', estimated_yield_sc_ha: '',
    real_yield_sc_ha: '', losses_pct: '', notes: '',
  });
  const [events, setEvents] = useState<NotebookEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!field?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/fields/${field.id}/notebook?category=harvest&limit=20`) as { events?: NotebookEvent[] };
      setEvents(res.events ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [field?.id]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const handleSave = async () => {
    if (!field?.id || !form.start_date) return;
    setSaving(true);
    try {
      await apiFetch(`/api/fields/${field.id}/notebook`, {
        method: 'POST',
        body: JSON.stringify({
          category: 'harvest',
          title: `Colheita — ${fmtDate(form.start_date)}`,
          occurred_at: form.start_date,
          data: {
            start_date: form.start_date,
            end_date: form.end_date || undefined,
            estimated_yield_sc_ha: form.estimated_yield_sc_ha ? parseFloat(form.estimated_yield_sc_ha) : undefined,
            real_yield_sc_ha: form.real_yield_sc_ha ? parseFloat(form.real_yield_sc_ha) : undefined,
            losses_pct: form.losses_pct ? parseFloat(form.losses_pct) : undefined,
            notes: form.notes || undefined,
          },
        }),
      });
      setForm({ start_date: todayISO(), end_date: '', estimated_yield_sc_ha: '', real_yield_sc_ha: '', losses_pct: '', notes: '' });
      await loadEvents();
    } catch { /* silencioso */ }
    setSaving(false);
  };

  if (!field) return <NoFieldSelected />;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-4 pb-2">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Início da colheita</label>
              <input type="date" className={inputCls} value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Término da colheita</label>
              <input type="date" className={inputCls} value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelCls}>Produtividade estimada (sc/ha)</label>
              <input type="number" className={inputCls} value={form.estimated_yield_sc_ha} onChange={e => setForm(p => ({...p, estimated_yield_sc_ha: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Produtividade real (sc/ha)</label>
              <input type="number" className={inputCls} value={form.real_yield_sc_ha} onChange={e => setForm(p => ({...p, real_yield_sc_ha: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Perdas estimadas (%)</label>
              <input type="number" className={inputCls} value={form.losses_pct} onChange={e => setForm(p => ({...p, losses_pct: e.target.value}))} />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Observações / Recomendações da IA</label>
            <textarea className={inputCls} rows={3} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Condições de colheita, pendências, recomendações..." />
          </div>
          <button onClick={handleSave} disabled={saving}
            className={btnPrimary}
            style={{ background: saving ? 'rgba(236,91,19,0.3)' : 'var(--primary)' }}>
            <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
            {saving ? 'Salvando...' : 'Registrar colheita'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-2 flex flex-col gap-2">
        {loading && <Spinner />}
        {!loading && events.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: '#334155' }}>Nenhuma colheita registrada.</p>
        )}
        {events.map(e => (
          <div key={e.id} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Colheita</span>
              <span className="text-[10px]" style={{ color: '#64748b' }}>{fmtDate(e.occurred_at)}</span>
              <div className="ml-auto">
                <DeleteEventButton
                  eventId={e.id}
                  onDeleted={() => setEvents(prev => prev.filter(x => x.id !== e.id))}
                />
              </div>
            </div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{e.title}</p>
            {e.data?.real_yield_sc_ha != null && (
              <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>
                🌾 {String(e.data.real_yield_sc_ha)} sc/ha (real)
                {e.data?.estimated_yield_sc_ha != null && ` · estimado: ${String(e.data.estimated_yield_sc_ha)} sc/ha`}
              </p>
            )}
            {e.data?.losses_pct != null && (
              <p className="text-[10px]" style={{ color: '#f87171' }}>Perdas: {String(e.data.losses_pct)}%</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SoilDocumentImportPanel() {
  const { fields, activeFieldId } = useAppStore();
  const activeField = activeFieldId ? fields.find((field) => field.id === activeFieldId) : null;
  const [file, setFile] = useState<ImportedNotebookFile | null>(null);
  const [notes, setNotes] = useState('');
  const [analysis, setAnalysis] = useState<FieldDocumentAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (selectedFile: File | undefined) => {
    setError(null);
    setAnalysis(null);
    if (!selectedFile) return;
    try {
      setFile(await readNotebookFile(selectedFile));
    } catch (err) {
      setFile(null);
      setError(err instanceof Error ? err.message : 'Falha ao importar o anexo.');
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Selecione um PDF ou imagem antes de analisar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeFieldDocument({
        field_id: activeField?.id,
        field_name: activeField?.name,
        file_name: file.name,
        mime_type: file.mimeType,
        file_base64: file.base64,
        notebook_section: 'solos_adubacoes',
        notes: notes || undefined,
      });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel analisar o anexo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-shrink-0 p-3 md:p-4" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,420px)_1fr] gap-3">
        <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Importar analise</p>
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>PDF ou imagem do laudo</p>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>upload_file</span>
          </div>

          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
            className="w-full rounded-lg px-3 py-2 text-xs"
            style={{ color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)' }}
          />

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Observacoes opcionais sobre o laudo"
            className={`${inputCls} mt-3 resize-none`}
          />

          {file && (
            <div className="mt-3 flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <span className="material-symbols-outlined" style={{ color: file.mimeType === 'application/pdf' ? '#ef4444' : 'var(--primary)' }}>
                {file.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image'}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{file.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{file.mimeType} - {formatFileSize(file.size)}</p>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-xs" style={{ color: '#f87171' }}>{error}</p>}

          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={loading || !file}
            className={`${btnPrimary} mt-3 w-full justify-center disabled:opacity-50`}
            style={{ background: 'var(--primary)' }}
          >
            <span className="material-symbols-outlined text-base">{loading ? 'progress_activity' : 'auto_awesome'}</span>
            {loading ? 'Lendo anexo...' : 'Ler e resumir anexo'}
          </button>
        </div>

        <div className="rounded-lg p-3 min-h-[150px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {file?.previewUrl && (
            <img src={file.previewUrl} alt="Previa do anexo" className="w-full max-h-36 object-contain rounded-lg mb-3" style={{ background: 'var(--bg)' }} />
          )}
          {analysis ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Resumo extraido</p>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.12)' }}>
                  Confianca {Math.round(analysis.confidence * 100)}%
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{analysis.summary}</p>
              {analysis.recommendations.length > 0 && (
                <div className="space-y-1">
                  {analysis.recommendations.map((item, index) => (
                    <p key={`${item}-${index}`} className="text-xs flex gap-2" style={{ color: 'var(--muted)' }}>
                      <span className="material-symbols-outlined text-sm" style={{ color: 'var(--primary)' }}>check_circle</span>
                      <span>{item}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[120px] flex items-center justify-center text-center">
              <p className="text-xs max-w-md" style={{ color: 'var(--muted)' }}>
                Selecione um PDF ou imagem do laudo para a Tracto extrair os principais dados agronomicos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoFieldSelected() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: '#334155' }}>map</span>
        <p className="text-sm font-semibold" style={{ color: '#475569' }}>Selecione um talhão no mapa</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-4">
      <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Caderno() {
  const [activeTab, setActiveTab] = useState<CadernoTab>('diario');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Tab bar — mobile: select dropdown · desktop: tabs distribuídas ─── */}
      <div
        className="flex-shrink-0"
        style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}
      >
        {/* Mobile: native select pra economizar espaço */}
        <div className="md:hidden px-3 py-2">
          <select
            className="tracto-select w-full rounded-lg px-3 py-2 text-sm font-bold"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as CadernoTab)}>
            {TABS.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>
        {/* Desktop: tabs horizontais distribuídas */}
        <div className="hidden md:flex items-stretch w-full px-2 py-1 overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all mx-0.5"
            style={
              activeTab === tab.id
                ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }
            }
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ display: activeTab === 'identificacao'  ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <IdentificacaoTab />
      </div>
      <div style={{ display: activeTab === 'diario'         ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <FieldLog />
      </div>
      <div style={{ display: activeTab === 'fitossanitario' ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <FitossanitarioTab />
      </div>
      <div style={{ display: activeTab === 'aplicacoes'     ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <AplicacoesTab />
      </div>
      <div style={{ display: activeTab === 'colheita'       ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <ColheitaTab />
      </div>
      <div style={{ display: activeTab === 'solo'           ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <SoilDocumentImportPanel />
        <SoilData />
      </div>
      <div style={{ display: activeTab === 'safras'         ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <Seasons />
      </div>
      <div style={{ display: activeTab === 'calculadora'    ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <Calculator />
      </div>

    </div>
  );
}
