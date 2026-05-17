import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { apiFetch } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ResearchEntry {
  fieldId: string;
  // Stand / estande
  plantsPerMeter?: number;       // plants per linear meter (counted)
  rowSpacingCm?: number;         // row spacing in cm (espaçamento entre fileiras)
  // Flowering / florescimento
  daysToFlowering?: number;      // days from emergence to expected flowering
  floweringDateActual?: string;  // ISO date - observed/confirmed
  // Notes
  notes?: string;
  updatedAt?: string;
}

type GDDData = { date: string; tmax: number; tmin: number }[];

// ── localStorage helpers ───────────────────────────────────────────────────────
const STORAGE_KEY = 'tracto-research-v1';

function loadAll(): Record<string, ResearchEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch { return {}; }
}

function saveAll(data: Record<string, ResearchEntry>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadEntry(fieldId: string): ResearchEntry {
  return loadAll()[fieldId] ?? { fieldId };
}

function saveEntry(entry: ResearchEntry) {
  const all = loadAll();
  all[entry.fieldId] = { ...entry, updatedAt: new Date().toISOString() };
  saveAll(all);
}

// ── Calculations ──────────────────────────────────────────────────────────────
function calcPlantsPerHa(plantsPerMeter?: number, rowSpacingCm?: number): number | null {
  if (!plantsPerMeter || !rowSpacingCm || rowSpacingCm <= 0) return null;
  return Math.round((plantsPerMeter / (rowSpacingCm / 100)) * 10000);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Accumulates GDD (base 10°C) from planting date using fetched temperature data */
function accumulateGDD(plantingDate: string, data: GDDData, base = 10): number {
  let acc = 0;
  for (const row of data) {
    if (row.date < plantingDate) continue;
    const avg = (row.tmax + row.tmin) / 2;
    const daily = Math.max(0, avg - base);
    acc += daily;
  }
  return Math.round(acc);
}

// ── Open-Meteo historical + forecast fetch ─────────────────────────────────────
async function fetchTemperatureHistory(lat: number, lng: number, startDate: string): Promise<GDDData> {
  const today = todayISO();
  const pastEnd = today; // archive up to yesterday + forecast covers today+
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${pastEnd}&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('API error');
  const json = await res.json();
  const times: string[] = json.daily?.time ?? [];
  const maxes: number[] = json.daily?.temperature_2m_max ?? [];
  const mins: number[] = json.daily?.temperature_2m_min ?? [];
  return times.map((t: string, i: number) => ({ date: t, tmax: maxes[i] ?? 25, tmin: mins[i] ?? 15 }));
}

// ── Status badge helpers ────────────────────────────────────────────────────────
type FlowerStatus = 'sem_plantio' | 'crescendo' | 'florescimento_hoje' | 'floresceu' | 'previsto';

function getFlowerStatus(
  plantingDate: string | undefined,
  predictedDate: string | null,
  actualDate: string | undefined,
): FlowerStatus {
  if (!plantingDate) return 'sem_plantio';
  if (actualDate) return 'floresceu';
  if (!predictedDate) return 'crescendo';
  const today = todayISO();
  if (predictedDate === today) return 'florescimento_hoje';
  if (predictedDate < today) return 'previsto'; // overdue prediction
  return 'previsto';
}

const STATUS_STYLES: Record<FlowerStatus, { label: string; bg: string; color: string }> = {
  sem_plantio:        { label: 'Sem plantio',     bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  crescendo:          { label: 'Crescendo',        bg: 'rgba(34,197,94,0.12)',   color: '#4ade80' },
  florescimento_hoje: { label: '🌸 Florescendo hoje!', bg: 'rgba(236,91,19,0.18)', color: '#fb923c' },
  floresceu:          { label: 'Floresceu ✓',      bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
  previsto:           { label: 'Florescimento previsto', bg: 'rgba(250,204,21,0.12)', color: '#fbbf24' },
};

// ── Edit Panel ────────────────────────────────────────────────────────────────
function EditPanel({
  fieldId,
  initialEntry,
  onSave,
  onCancel,
}: {
  fieldId: string;
  initialEntry: ResearchEntry;
  onSave: (e: ResearchEntry) => void;
  onCancel: () => void;
}) {
  const [plantsPerMeter, setPlantsPerMeter] = useState(initialEntry.plantsPerMeter?.toString() ?? '');
  const [rowSpacing, setRowSpacing] = useState(initialEntry.rowSpacingCm?.toString() ?? '50');
  const [daysToFlower, setDaysToFlower] = useState(initialEntry.daysToFlowering?.toString() ?? '');
  const [actualDate, setActualDate] = useState(initialEntry.floweringDateActual ?? '');
  const [notes, setNotes] = useState(initialEntry.notes ?? '');

  const ppm = parseFloat(plantsPerMeter) || undefined;
  const rs = parseFloat(rowSpacing) || undefined;
  const plantsHa = calcPlantsPerHa(ppm, rs);

  const inpCls = 'w-full px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none focus:border-[var(--primary)] transition-colors';
  const inpStyle = { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' };
  const lblCls = 'text-[10px] font-black uppercase tracking-widest mb-1 block';

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
      {/* Stand section */}
      <div>
        <p className={lblCls} style={{ color: '#4ade80' }}>Estande de Planta</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--muted)' }}>Plantas por metro linear</label>
            <input className={inpCls} style={inpStyle} type="number" step="0.1" min="0" value={plantsPerMeter} onChange={(e) => setPlantsPerMeter(e.target.value)} placeholder="Ex: 14" />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--muted)' }}>Espaçamento entre fileiras (cm)</label>
            <input className={inpCls} style={inpStyle} type="number" min="10" max="200" value={rowSpacing} onChange={(e) => setRowSpacing(e.target.value)} placeholder="Ex: 50" />
          </div>
        </div>
        {plantsHa && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#4ade80' }}>grass</span>
            <span className="text-xs font-bold" style={{ color: '#4ade80' }}>
              Estande calculado: <strong>{plantsHa.toLocaleString('pt-BR')}</strong> plantas/ha
            </span>
          </div>
        )}
      </div>

      {/* Flowering section */}
      <div>
        <p className={lblCls} style={{ color: '#fb923c' }}>Florescimento</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--muted)' }}>Dias previstos para floresc. (após plantio)</label>
            <input className={inpCls} style={inpStyle} type="number" min="1" max="365" value={daysToFlower} onChange={(e) => setDaysToFlower(e.target.value)} placeholder="Ex: 45" />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--muted)' }}>Data real de florescimento</label>
            <input className={inpCls} style={inpStyle} type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[11px] mb-1 block" style={{ color: 'var(--muted)' }}>Observações</label>
        <textarea
          className={inpCls + ' resize-none'}
          style={{ ...inpStyle, minHeight: 64 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas sobre este bloco..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({
            fieldId,
            plantsPerMeter: ppm,
            rowSpacingCm: rs,
            daysToFlowering: parseFloat(daysToFlower) || undefined,
            floweringDateActual: actualDate || undefined,
            notes: notes || undefined,
          })}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          <span className="material-symbols-outlined text-base">save</span>
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
          style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Avaliações Fenológicas ─────────────────────────────────────────────────────
interface FenologicalEval {
  id: string;
  date: string;
  stage: string;
  stand_plants_m2?: number;
  height_cm?: number;
  disease_score?: number;
  notes?: string;
}

const FENO_KEY = 'tracto-fenologia-v1';
const FENOLOGICAL_STAGES = ['VE','V1','V2','V3','V4','V5','V6','V7','V8','V9','R1','R2','R3','R4','R5','R6','R7','R8','Maturação'];

function loadFenologia(fieldId: string): FenologicalEval[] {
  try { return JSON.parse(localStorage.getItem(FENO_KEY) ?? '{}')[fieldId] ?? []; } catch { return []; }
}

function saveFenologia(fieldId: string, evals: FenologicalEval[]) {
  try {
    const all = JSON.parse(localStorage.getItem(FENO_KEY) ?? '{}');
    all[fieldId] = evals;
    localStorage.setItem(FENO_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function FenologiaPanel({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const [evals, setEvals] = useState<FenologicalEval[]>(() => loadFenologia(fieldId));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', stage: 'V1', stand_plants_m2: '', height_cm: '', disease_score: '', notes: '' });

  const handleAdd = () => {
    if (!form.date || !form.stage) return;
    const ev: FenologicalEval = {
      id: crypto.randomUUID(),
      date: form.date,
      stage: form.stage,
      stand_plants_m2: form.stand_plants_m2 ? Number(form.stand_plants_m2) : undefined,
      height_cm: form.height_cm ? Number(form.height_cm) : undefined,
      disease_score: form.disease_score ? Number(form.disease_score) : undefined,
      notes: form.notes || undefined,
    };
    const updated = [...evals, ev].sort((a, b) => a.date.localeCompare(b.date));
    setEvals(updated);
    saveFenologia(fieldId, updated);
    setForm({ date: '', stage: 'V1', stand_plants_m2: '', height_cm: '', disease_score: '', notes: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = evals.filter(e => e.id !== id);
    setEvals(updated);
    saveFenologia(fieldId, updated);
  };

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: '#4ade80' }}>grass</span>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#4ade80' }}>
            Avaliações Fenológicas — {fieldName}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
          <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Nova Avaliação'}
        </button>
      </div>

      {showForm && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Data *', key: 'date', type: 'date' },
            { label: 'Estande (pl/m²)', key: 'stand_plants_m2', type: 'number', placeholder: '0' },
            { label: 'Altura (cm)', key: 'height_cm', type: 'number', placeholder: '0' },
            { label: 'Nota doenças (1-9)', key: 'disease_score', type: 'number', placeholder: '1-9' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
              <input type={type} value={form[key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-transparent border"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }} />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Estádio *</label>
            <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white border"
              style={{ borderColor: 'rgba(255,255,255,0.12)', background: '#1e293b' }}>
              {FENOLOGICAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Observações</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notas de campo..."
              className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-transparent border"
              style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <button onClick={handleAdd} disabled={!form.date}
            className="col-span-2 sm:col-span-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
            style={{ background: '#4ade80', color: '#0f172a' }}>
            Registrar Avaliação
          </button>
        </div>
      )}

      {/* Mini-timeline dos estádios */}
      {evals.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {evals.map(ev => (
            <span key={ev.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
              {ev.stage} · {ev.date.split('-').reverse().slice(0,2).join('/')}
            </span>
          ))}
        </div>
      )}

      {/* Lista */}
      {evals.length === 0 && !showForm && (
        <p className="text-xs text-center py-3" style={{ color: 'var(--muted)' }}>Nenhuma avaliação registrada para este talhão.</p>
      )}
      <div className="flex flex-col gap-1.5">
        {evals.map(ev => (
          <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-white">{ev.stage}</span>
              <span className="mx-1" style={{ color: 'var(--muted)' }}>·</span>
              <span style={{ color: 'var(--muted)' }}>{ev.date.split('-').reverse().join('/')}</span>
              {ev.stand_plants_m2 != null && <span className="ml-2" style={{ color: '#94a3b8' }}>Estande: {ev.stand_plants_m2} pl/m²</span>}
              {ev.height_cm != null && <span className="ml-2" style={{ color: '#94a3b8' }}>Alt: {ev.height_cm} cm</span>}
              {ev.disease_score != null && <span className="ml-2" style={{ color: '#f59e0b' }}>Nota: {ev.disease_score}/9</span>}
              {ev.notes && <p className="mt-0.5 italic" style={{ color: 'var(--muted)' }}>{ev.notes}</p>}
            </div>
            <button onClick={() => handleDelete(ev.id)} className="p-1 rounded hover:bg-red-500/10 flex-shrink-0" style={{ color: '#f87171' }}>
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NDVI Panel ─────────────────────────────────────────────────────────────────
interface NdviResult {
  ndvi: number;
  scene_date: string;
  interpretation: string;
  color: string;
  status: string;
}

function NdviPanel({ fieldId, lat, lng }: { fieldId: string; lat: number; lng: number }) {
  const [result, setResult] = useState<NdviResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const delta = 0.005; // ~500m box around field center
  const boundaries: number[][] = [
    [lat - delta, lng - delta],
    [lat - delta, lng + delta],
    [lat + delta, lng + delta],
    [lat + delta, lng - delta],
    [lat - delta, lng - delta],
  ];

  const fetchNdvi = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch<NdviResult>(`/api/fields/${fieldId}/parcels/ndvi`, {
        method: 'POST',
        body: JSON.stringify({ parcel_boundaries: boundaries }),
      });
      setResult(res);
    } catch {
      setError('Não foi possível obter NDVI. Verifique a integração SentinelHub.');
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [fieldId, lat, lng]);

  useEffect(() => { void fetchNdvi(); }, [fetchNdvi]);

  if (loading) return (
    <div className="flex items-center gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)' }}>
      <span className="material-symbols-outlined text-sm animate-spin" style={{ color: '#4ade80' }}>progress_activity</span>
      <span style={{ color: '#4ade80' }}>Buscando NDVI via satélite...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
      <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>satellite_alt</span>
      <div>
        <p className="font-bold" style={{ color: '#f87171' }}>NDVI indisponível</p>
        <p style={{ color: '#94a3b8' }}>{error}</p>
      </div>
      <button onClick={() => { setFetched(false); void fetchNdvi(); }} className="ml-auto px-2 py-1 rounded-lg text-xs font-bold"
        style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
        Tentar novamente
      </button>
    </div>
  );

  if (!result) return null;

  // Color & gauge based on NDVI value
  const ndvPct = Math.round(((result.ndvi + 1) / 2) * 100); // -1..1 → 0..100%
  const gaugeColor = result.ndvi >= 0.6 ? '#4ade80' : result.ndvi >= 0.4 ? '#86efac' : result.ndvi >= 0.2 ? '#fbbf24' : result.ndvi >= 0 ? '#f97316' : '#f87171';

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: '#4ade80' }}>satellite_alt</span>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#4ade80' }}>
            NDVI — Índice de Vegetação
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
          {result.scene_date}
        </span>
      </div>

      {/* Big number */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-black" style={{ color: gaugeColor }}>{result.ndvi.toFixed(3)}</p>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: gaugeColor }}>{result.status}</p>
        </div>
        <div className="flex-1">
          {/* Gauge bar */}
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${ndvPct}%`, background: gaugeColor }} />
          </div>
          <div className="flex justify-between text-[9px] mt-1" style={{ color: '#475569' }}>
            <span>-1 (Água/Solo)</span>
            <span>0</span>
            <span>+1 (Vegetação densa)</span>
          </div>
        </div>
      </div>

      <p className="text-xs p-2.5 rounded-lg italic" style={{ background: 'rgba(255,255,255,0.02)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.04)' }}>
        {result.interpretation}
      </p>

      {fetched && (
        <button onClick={() => void fetchNdvi()} className="self-end flex items-center gap-1 text-[10px] font-semibold hover:opacity-70"
          style={{ color: '#64748b' }}>
          <span className="material-symbols-outlined text-xs">refresh</span>
          Atualizar
        </button>
      )}
    </div>
  );
}

// ── Block Card ─────────────────────────────────────────────────────────────────
function BlockCard({
  field,
  farmName,
  entry,
  gddData,
  onEdit,
  onClearActual,
  onFenologia,
  fenologiaActive,
}: {
  field: { id?: string; name?: string; cultura?: string; variedade?: string; dataPlantio?: string; lat: number; lng: number; areaHa?: number };
  farmName: string;
  entry: ResearchEntry;
  gddData: GDDData;
  onEdit: () => void;
  onClearActual: () => void;
  onFenologia: () => void;
  fenologiaActive: boolean;
}) {
  const plantsHa = calcPlantsPerHa(entry.plantsPerMeter, entry.rowSpacingCm);

  // Predicted flowering date (days-based)
  const predictedDate = entry.daysToFlowering && field.dataPlantio
    ? addDays(field.dataPlantio, entry.daysToFlowering)
    : null;

  // GDD-based prediction (if we have data)
  const gddAccumulated = gddData.length > 0 && field.dataPlantio
    ? accumulateGDD(field.dataPlantio, gddData)
    : null;

  const status = getFlowerStatus(field.dataPlantio, predictedDate, entry.floweringDateActual);
  const statusStyle = STATUS_STYLES[status];

  const today = todayISO();
  const daysUntilFlower = predictedDate && predictedDate > today
    ? daysBetween(today, predictedDate)
    : null;
  const daysSinceFlower = entry.floweringDateActual
    ? daysBetween(entry.floweringDateActual, today)
    : null;
  const daysOverdue = predictedDate && predictedDate < today && !entry.floweringDateActual
    ? daysBetween(predictedDate, today)
    : null;

  return (
    <div className="rounded-2xl border flex flex-col overflow-hidden transition-all hover:border-white/10"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>

      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>{farmName}</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >{statusStyle.label}</span>
          </div>
          <p className="text-sm font-bold text-white mt-1.5">{field.name ?? 'Talhão'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {[field.variedade, field.cultura, field.areaHa ? `${field.areaHa.toFixed(1)} ha` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onEdit} className="flex-shrink-0 p-2 rounded-xl hover:bg-white/5 transition-all" title="Editar dados de pesquisa">
          <span className="material-symbols-outlined text-base" style={{ color: '#60a5fa' }}>edit_note</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 divide-x" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.05)' }}>

        {/* Stand */}
        <div className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4ade80' }}>
            <span className="material-symbols-outlined text-xs align-middle mr-0.5">grass</span>
            Estande
          </p>
          {plantsHa ? (
            <>
              <p className="text-lg font-black text-white leading-tight">{plantsHa.toLocaleString('pt-BR')}</p>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                plantas/ha · {entry.plantsPerMeter} pl/m · {entry.rowSpacingCm}cm
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: '#334155' }}>Não informado</p>
          )}
        </div>

        {/* Flowering */}
        <div className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#fb923c' }}>
            <span className="material-symbols-outlined text-xs align-middle mr-0.5">local_florist</span>
            Florescimento
          </p>
          {entry.floweringDateActual ? (
            <>
              <p className="text-lg font-black text-white leading-tight">{fmtDate(entry.floweringDateActual)}</p>
              <div className="flex items-center gap-1">
                <p className="text-[10px]" style={{ color: '#60a5fa' }}>
                  Real {daysSinceFlower !== null ? `· ${daysSinceFlower}d atrás` : ''}
                </p>
                <button onClick={onClearActual} title="Remover data real" className="p-0.5 rounded hover:bg-white/10 transition-all" style={{ color: '#475569' }}>
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            </>
          ) : predictedDate ? (
            <>
              <p className="text-lg font-black leading-tight" style={{ color: '#fbbf24' }}>{fmtDate(predictedDate)}</p>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {daysUntilFlower !== null
                  ? `Previsto · faltam ${daysUntilFlower} dia${daysUntilFlower !== 1 ? 's' : ''}`
                  : daysOverdue !== null
                    ? `Previsto · ${daysOverdue}d atrasado`
                    : 'Previsto'}
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: '#334155' }}>
              {field.dataPlantio ? 'Informe dias para floresc.' : 'Sem data de plantio'}
            </p>
          )}
        </div>
      </div>

      {/* Plantio + GDD row */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>calendar_today</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Plantio: <strong className="text-white">{field.dataPlantio ? fmtDate(field.dataPlantio) : '—'}</strong>
          </span>
        </div>
        {gddAccumulated !== null && field.dataPlantio && (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ color: '#f97316' }}>thermostat</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Soma térmica: <strong className="text-white">{gddAccumulated} °C·dia</strong>
            </span>
          </div>
        )}
        {entry.notes && (
          <div className="flex items-center gap-1" title={entry.notes}>
            <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>notes</span>
            <span className="text-[10px] truncate max-w-[120px]" style={{ color: '#475569' }}>{entry.notes}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={onFenologia}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:opacity-80"
          style={{
            background: fenologiaActive ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.06)',
            color: '#4ade80',
            border: `1px solid ${fenologiaActive ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.15)'}`,
          }}
        >
          <span className="material-symbols-outlined text-sm">monitoring</span>
          Avaliações
        </button>
      </div>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────────
interface TimelineItem {
  fieldId: string;
  fieldName: string;
  farmName: string;
  variedade?: string;
  plantingDate?: string;
  predictedDate: string | null;
  actualDate?: string;
}

function FloweringTimeline({ items }: { items: TimelineItem[] }) {
  const today = todayISO();

  const dated = items
    .filter(i => i.predictedDate || i.actualDate)
    .sort((a, b) => {
      const da = a.actualDate ?? a.predictedDate ?? '';
      const db = b.actualDate ?? b.predictedDate ?? '';
      return da.localeCompare(db);
    });

  if (dated.length === 0) return null;

  // Determine range
  const allDates = dated.flatMap(i => [i.predictedDate, i.actualDate, i.plantingDate].filter(Boolean) as string[]);
  const minDate = allDates.reduce((a, b) => (a < b ? a : b), allDates[0]);
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b), allDates[0]);
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1);

  const pct = (date: string) => Math.max(0, Math.min(100, (daysBetween(minDate, date) / totalDays) * 100));
  const todayPct = today >= minDate && today <= maxDate ? pct(today) : null;

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Timeline de Florescimento
        </p>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#fbbf24' }}></span>Previsto</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#60a5fa' }}></span>Real</span>
        </div>
      </div>

      {/* Date labels */}
      <div className="flex justify-between text-[10px]" style={{ color: '#334155' }}>
        <span>{fmtDate(minDate)}</span>
        <span>{fmtDate(maxDate)}</span>
      </div>

      {/* Tracks */}
      <div className="flex flex-col gap-2.5">
        {dated.map(item => {
          const displayDate = item.actualDate ?? item.predictedDate!;
          const isActual = !!item.actualDate;
          const dotColor = isActual ? '#60a5fa' : '#fbbf24';
          const barLeft = item.plantingDate ? pct(item.plantingDate) : 0;
          const barRight = 100 - pct(displayDate);

          return (
            <div key={item.fieldId} className="flex items-center gap-3">
              {/* Label */}
              <div className="w-32 flex-shrink-0 text-right">
                <p className="text-[11px] font-semibold text-white truncate">{item.fieldName}</p>
                <p className="text-[9px] truncate" style={{ color: 'var(--muted)' }}>{item.variedade ?? item.farmName}</p>
              </div>

              {/* Track */}
              <div className="flex-1 relative h-5 flex items-center">
                {/* Background track */}
                <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

                {/* Growing bar */}
                {item.plantingDate && item.plantingDate >= minDate && (
                  <div
                    className="absolute h-2 rounded-full"
                    style={{
                      left: `${barLeft}%`,
                      right: `${barRight}%`,
                      background: 'rgba(34,197,94,0.25)',
                      minWidth: 2,
                    }}
                  />
                )}

                {/* Flowering dot */}
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-[var(--bg)] transform -translate-x-1/2"
                  style={{ left: `${pct(displayDate)}%`, background: dotColor }}
                  title={`${isActual ? 'Real' : 'Previsto'}: ${fmtDate(displayDate)}`}
                />

                {/* Today line */}
                {todayPct !== null && (
                  <div className="absolute w-0.5 h-full rounded-full opacity-60" style={{ left: `${todayPct}%`, background: '#ec5b13' }} />
                )}
              </div>

              {/* Date */}
              <div className="w-16 flex-shrink-0">
                <p className="text-[10px] font-bold" style={{ color: dotColor }}>{fmtDate(displayDate)}</p>
              </div>
            </div>
          );
        })}

        {/* Today marker label */}
        {todayPct !== null && (
          <div className="flex items-center gap-3">
            <div className="w-32 flex-shrink-0" />
            <div className="flex-1 relative">
              <div style={{ position: 'absolute', left: `${todayPct}%`, transform: 'translateX(-50%)' }}>
                <span className="text-[9px] font-bold" style={{ color: '#ec5b13' }}>Hoje</span>
              </div>
            </div>
            <div className="w-16 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV(
  fields: { id?: string; name?: string; cultura?: string; variedade?: string; dataPlantio?: string; lat: number; lng: number; areaHa?: number; farm_id?: string }[],
  farms: { id: string; name: string }[],
  entries: Record<string, ResearchEntry>,
) {
  const header = [
    'Fazenda', 'Talhão', 'Cultura', 'Variedade', 'Área (ha)',
    'Data Plantio', 'Plantas/metro', 'Espaçamento (cm)', 'Plantas/ha',
    'Dias para floresc.', 'Data floresc. prevista', 'Data floresc. real', 'Obs'
  ].join(';');

  const rows = fields.map(f => {
    const farm = farms.find(fm => fm.id === f.farm_id);
    const entry = entries[f.id ?? ''] ?? {};
    const plantsHa = calcPlantsPerHa(entry.plantsPerMeter, entry.rowSpacingCm);
    const predictedDate = entry.daysToFlowering && f.dataPlantio
      ? addDays(f.dataPlantio, entry.daysToFlowering)
      : '';
    return [
      farm?.name ?? '', f.name ?? '', f.cultura ?? '', f.variedade ?? '',
      f.areaHa?.toFixed(2) ?? '',
      f.dataPlantio ? fmtDate(f.dataPlantio) : '',
      entry.plantsPerMeter ?? '', entry.rowSpacingCm ?? '',
      plantsHa ?? '',
      entry.daysToFlowering ?? '',
      predictedDate ? fmtDate(predictedDate) : '',
      entry.floweringDateActual ? fmtDate(entry.floweringDateActual) : '',
      entry.notes ?? '',
    ].join(';');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pesquisa-florescimento-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPERIMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
interface Treatment {
  label: string;
  description: string;
  product: string;
  dose: string;
}

interface Experiment {
  id: string;
  name: string;
  cultura: string;
  objetivo: string;
  treatments: Treatment[];
  repetitions: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

const EXP_KEY = 'tracto-experiments-v1';

function loadExperiments(): Experiment[] {
  try { return JSON.parse(localStorage.getItem(EXP_KEY) ?? '[]'); } catch { return []; }
}

function saveExperiments(exps: Experiment[]) {
  try { localStorage.setItem(EXP_KEY, JSON.stringify(exps)); } catch { /* ignore */ }
}

const TREATMENT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function statPower(nTreatments: number, nRep: number): { design: string; power: string; color: string } {
  const design = nRep >= 3 ? 'Delineamento em blocos completos ao acaso (DBCA)' : 'Delineamento inteiramente casualizado (DIC)';
  const score = nTreatments * nRep;
  if (score >= 15) return { design, power: 'Alto poder estatístico', color: '#4ade80' };
  if (score >= 9)  return { design, power: 'Poder estatístico moderado', color: '#fbbf24' };
  return { design, power: 'Poder estatístico baixo — aumente repetições', color: '#f87171' };
}

const inpClsExp = 'w-full px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none focus:border-[var(--primary)] transition-colors';
const inpStyleExp = { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' };

// ── ANOVA types ────────────────────────────────────────────────────────────────
interface AnovaResult {
  anova: { f_statistic: number; p_value: number; significant: boolean; df_between: number; df_within: number };
  means: Record<string, { mean: number; std: number; n: number; letter: string }>;
  cv_pct: number;
  mse: number;
  tukey_groups: string;
  interpretation: string;
}

const LETTER_COLORS = ['#60a5fa','#4ade80','#f59e0b','#f472b6','#a78bfa','#34d399'];

// Gera relatório TXT de um experimento
function exportResearchReport(exp: Experiment, anova: AnovaResult | null) {
  const lines: string[] = [
    '='.repeat(60),
    'RELATÓRIO DE EXPERIMENTO — TRACTO AGRO',
    '='.repeat(60),
    '',
    `Título:     ${exp.name}`,
    `Cultura:    ${exp.cultura || '—'}`,
    `Objetivo:   ${exp.objetivo || '—'}`,
    `Período:    ${exp.startDate || '—'} a ${exp.endDate || '—'}`,
    `Gerado em:  ${new Date().toLocaleString('pt-BR')}`,
    '',
    '-'.repeat(60),
    'DELINEAMENTO EXPERIMENTAL',
    '-'.repeat(60),
    `Tipo:             ${exp.repetitions >= 3 ? 'DBC — Delineamento em Blocos Completos ao Acaso' : 'DIC — Delineamento Inteiramente Casualizado'}`,
    `Nº de tratamentos: ${exp.treatments.length}`,
    `Nº de repetições:  ${exp.repetitions}`,
    `Total de parcelas: ${exp.treatments.length * exp.repetitions}`,
    '',
    '-'.repeat(60),
    'TRATAMENTOS',
    '-'.repeat(60),
    ...exp.treatments.map(t =>
      `${t.label} — ${t.description || '—'}${t.product ? ' | Produto: ' + t.product : ''}${t.dose ? ' | Dose: ' + t.dose : ''}`
    ),
    '',
  ];

  if (anova) {
    lines.push(
      '-'.repeat(60),
      'RESULTADOS ANOVA (α = 0,05)',
      '-'.repeat(60),
      `F calculado:  ${anova.anova.f_statistic.toFixed(4)}`,
      `p-valor:      ${anova.anova.p_value.toFixed(6)}`,
      `GL tratam.:   ${anova.anova.df_between}`,
      `GL resíduo:   ${anova.anova.df_within}`,
      `MSE:          ${anova.mse.toFixed(6)}`,
      `CV%:          ${anova.cv_pct.toFixed(2)}%`,
      `Significativo: ${anova.anova.significant ? 'SIM (p < 0,05)' : 'NÃO (p ≥ 0,05)'}`,
      '',
      '-'.repeat(60),
      'TABELA DE MÉDIAS — TUKEY HSD (α = 0,05)',
      '-'.repeat(60),
      `${'Tratamento'.padEnd(14)} ${'Média'.padEnd(10)} ${'Desvio'.padEnd(10)} ${'n'.padEnd(5)} Letra`,
      ...Object.entries(anova.means)
        .sort((a, b) => b[1].mean - a[1].mean)
        .map(([name, s]) =>
          `${name.padEnd(14)} ${String(s.mean.toFixed(4)).padEnd(10)} ${String(s.std.toFixed(4)).padEnd(10)} ${String(s.n).padEnd(5)} ${s.letter}`
        ),
      '',
      '-'.repeat(60),
      'INTERPRETAÇÃO',
      '-'.repeat(60),
      anova.interpretation,
      '',
    );
  }

  lines.push('='.repeat(60), 'Gerado por Tracto Agro | tracto.app', '='.repeat(60));

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-${exp.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── AnovaPanel: painel de ANOVA por experimento ───────────────────────────────
function AnovaPanel({ exp }: { exp: Experiment }) {
  const [inputData, setInputData] = useState<Record<string, string>>(() =>
    Object.fromEntries(exp.treatments.map(t => [t.label, '']))
  );
  const [result, setResult] = useState<AnovaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate = exp.treatments.length >= 2 &&
    exp.treatments.every(t => {
      const vals = (inputData[t.label] ?? '').split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      return vals.length >= 2;
    });

  const handleCalc = useCallback(async () => {
    setLoading(true); setError(null);
    const groups: Record<string, number[]> = {};
    for (const t of exp.treatments) {
      groups[t.label] = (inputData[t.label] ?? '').split(',')
        .map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    }
    try {
      const res = await apiFetch<AnovaResult>('/api/stats/anova', { method: 'POST', body: JSON.stringify({ groups }) });
      setResult(res);
    } catch (e) {
      setError('Erro ao calcular. Verifique se há pelo menos 2 valores por tratamento.');
    } finally {
      setLoading(false);
    }
  }, [exp.treatments, inputData]);

  const allLetters = result ? [...new Set(Object.values(result.means).map(m => m.letter))] : [];

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl" style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.12)' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#60a5fa' }}>
          Análise Estatística — ANOVA + Tukey HSD
        </p>
        {result && (
          <button
            onClick={() => exportResearchReport(exp, result)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Exportar Relatório
          </button>
        )}
      </div>

      {/* Input por tratamento */}
      <div className="grid sm:grid-cols-2 gap-2">
        {exp.treatments.map(t => (
          <div key={t.label}>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>
              Tratamento {t.label}{t.description ? ` — ${t.description}` : ''} (valores separados por vírgula)
            </label>
            <input
              type="text"
              value={inputData[t.label] ?? ''}
              onChange={e => setInputData(prev => ({ ...prev, [t.label]: e.target.value }))}
              placeholder={`Ex: 45.2, 46.1, 44.8`}
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none transition-colors"
              style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(255,255,255,0.03)' }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => void handleCalc()}
        disabled={!canCalculate || loading}
        className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: '#60a5fa', color: '#0f172a' }}
      >
        {loading ? (
          <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Calculando...</>
        ) : (
          <><span className="material-symbols-outlined text-sm">analytics</span>Calcular ANOVA</>
        )}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Resultado */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* Badge principal */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: result.anova.significant ? 'rgba(34,197,94,0.08)' : 'rgba(100,116,139,0.08)',
              border: `1px solid ${result.anova.significant ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
            }}>
            <span className="material-symbols-outlined text-xl" style={{ color: result.anova.significant ? '#4ade80' : '#64748b' }}>
              {result.anova.significant ? 'check_circle' : 'remove_circle'}
            </span>
            <div>
              <p className="font-black text-sm" style={{ color: result.anova.significant ? '#4ade80' : '#94a3b8' }}>
                {result.anova.significant ? 'Diferença Significativa (p < 0,05)' : 'Sem Diferença Significativa (p ≥ 0,05)'}
              </p>
              <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
                F = {result.anova.f_statistic.toFixed(2)} &nbsp;|&nbsp; p = {result.anova.p_value.toFixed(4)} &nbsp;|&nbsp; GL = {result.anova.df_between}/{result.anova.df_within}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>CV%</p>
              <p className="font-black" style={{ color: result.cv_pct < 10 ? '#4ade80' : result.cv_pct < 20 ? '#f59e0b' : '#f87171' }}>
                {result.cv_pct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Tabela de médias */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Tratamento', 'Média', 'Desvio', 'n', 'Letra'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.means)
                  .sort((a, b) => b[1].mean - a[1].mean)
                  .map(([name, s]) => {
                    const letterIdx = allLetters.indexOf(s.letter);
                    const letterColor = LETTER_COLORS[letterIdx % LETTER_COLORS.length];
                    return (
                      <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="px-2 py-2 font-bold text-white">{name}</td>
                        <td className="px-2 py-2 font-bold" style={{ color: '#4ade80' }}>{s.mean.toFixed(4)}</td>
                        <td className="px-2 py-2" style={{ color: '#94a3b8' }}>±{s.std.toFixed(4)}</td>
                        <td className="px-2 py-2" style={{ color: '#94a3b8' }}>{s.n}</td>
                        <td className="px-2 py-2">
                          <span className="font-black px-2 py-0.5 rounded-md text-xs"
                            style={{ background: `${letterColor}22`, color: letterColor }}>
                            {s.letter}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Interpretação */}
          <p className="text-xs p-3 rounded-xl italic" style={{ background: 'rgba(255,255,255,0.02)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.05)' }}>
            {result.interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

function ExperimentsTab() {
  const [experiments, setExperiments] = useState<Experiment[]>(loadExperiments);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [cultura, setCultura] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [treatments, setTreatments] = useState<Treatment[]>([
    { label: 'A', description: '', product: '', dose: '' },
    { label: 'B', description: '', product: '', dose: '' },
  ]);
  const [repetitions, setRepetitions] = useState(3);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const resetForm = () => {
    setName(''); setCultura(''); setObjetivo('');
    setTreatments([
      { label: 'A', description: '', product: '', dose: '' },
      { label: 'B', description: '', product: '', dose: '' },
    ]);
    setRepetitions(3); setStartDate(''); setEndDate('');
    setShowForm(false);
  };

  const addTreatment = () => {
    const nextLabel = TREATMENT_LABELS[treatments.length] ?? String(treatments.length + 1);
    setTreatments(t => [...t, { label: nextLabel, description: '', product: '', dose: '' }]);
  };

  const updateTreatment = (idx: number, field: keyof Treatment, value: string) => {
    setTreatments(t => t.map((tr, i) => i === idx ? { ...tr, [field]: value } : tr));
  };

  const removeTreatment = (idx: number) => {
    setTreatments(t => {
      const filtered = t.filter((_, i) => i !== idx);
      return filtered.map((tr, i) => ({ ...tr, label: TREATMENT_LABELS[i] ?? String(i + 1) }));
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const exp: Experiment = {
      id: crypto.randomUUID(),
      name: name.trim(),
      cultura: cultura.trim(),
      objetivo: objetivo.trim(),
      treatments,
      repetitions,
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    };
    const updated = [exp, ...experiments];
    saveExperiments(updated);
    setExperiments(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Excluir este experimento?')) return;
    const updated = experiments.filter(e => e.id !== id);
    saveExperiments(updated);
    setExperiments(updated);
    if (expandedId === id) setExpandedId(null);
  };

  const fmtDateBr = (iso: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">Experimentos</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Planeje ensaios comparativos com tratamentos e repetições.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Novo Experimento'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border p-5 flex flex-col gap-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.09)' }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Novo Experimento</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Nome do Experimento *</label>
              <input className={inpClsExp} style={inpStyleExp} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Comparativo de fungicidas" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Cultura</label>
              <input className={inpClsExp} style={inpStyleExp} value={cultura} onChange={e => setCultura(e.target.value)} placeholder="Ex: Soja" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Objetivo</label>
            <textarea
              className={inpClsExp + ' resize-none'}
              style={{ ...inpStyleExp, minHeight: 64 }}
              value={objetivo}
              onChange={e => setObjetivo(e.target.value)}
              placeholder="Descreva o objetivo do experimento..."
            />
          </div>

          {/* Treatments */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#60a5fa' }}>Tratamentos</p>
              <button
                onClick={addTreatment}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
                style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Adicionar tratamento
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {treatments.map((tr, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.12)' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                    {tr.label}
                  </div>
                  <div className="flex-1 grid sm:grid-cols-3 gap-2">
                    <input className={inpClsExp} style={inpStyleExp} value={tr.description} onChange={e => updateTreatment(idx, 'description', e.target.value)} placeholder="Descrição" />
                    <input className={inpClsExp} style={inpStyleExp} value={tr.product} onChange={e => updateTreatment(idx, 'product', e.target.value)} placeholder="Produto" />
                    <input className={inpClsExp} style={inpStyleExp} value={tr.dose} onChange={e => updateTreatment(idx, 'dose', e.target.value)} placeholder="Dose (ex: 1 L/ha)" />
                  </div>
                  {treatments.length > 2 && (
                    <button onClick={() => removeTreatment(idx)} className="p-1.5 rounded-lg hover:bg-red-500/10 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }}>
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Repetitions + Dates */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Repetições / Blocos</label>
              <input
                className={inpClsExp} style={inpStyleExp}
                type="number" min={1} max={20}
                value={repetitions}
                onChange={e => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Data Início</label>
              <input type="date" className={inpClsExp} style={inpStyleExp} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Data Fim Prevista</label>
              <input type="date" className={inpClsExp} style={inpStyleExp} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Statistical power preview */}
          {treatments.length >= 2 && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {(() => {
                const sp = statPower(treatments.length, repetitions);
                return (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold" style={{ color: sp.color }}>{sp.power}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{sp.design}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {treatments.length} tratamentos × {repetitions} repetições = {treatments.length * repetitions} parcelas
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/5" style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--primary)' }}
            >
              <span className="material-symbols-outlined text-base">save</span>
              Salvar Experimento
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {experiments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(236,91,19,0.10)' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--primary)' }}>science</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white mb-1">Nenhum experimento cadastrado</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Clique em "+ Novo Experimento" para começar a planejar seus ensaios comparativos.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {experiments.map(exp => {
            const sp = statPower(exp.treatments.length, exp.repetitions);
            const isExpanded = expandedId === exp.id;
            return (
              <div key={exp.id} className="rounded-2xl border overflow-hidden transition-all" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
                {/* Card header */}
                <div className="flex items-start gap-3 p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                    <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>science</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{exp.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {exp.cultura && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>{exp.cultura}</span>}
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>{exp.treatments.length} tratamentos</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>{exp.repetitions} rep.</span>
                      <span className="text-[11px] font-semibold" style={{ color: sp.color }}>{sp.power.split(' — ')[0]}</span>
                    </div>
                    {(exp.startDate || exp.endDate) && (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                        {fmtDateBr(exp.startDate)} {exp.endDate ? `→ ${fmtDateBr(exp.endDate)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                      className="p-2 rounded-xl hover:bg-white/5 transition-all"
                      style={{ color: '#60a5fa' }}
                    >
                      <span className="material-symbols-outlined text-base">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="p-2 rounded-xl hover:bg-red-500/10 transition-all"
                      style={{ color: '#f87171' }}
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {exp.objetivo && (
                      <div className="pt-3">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Objetivo</p>
                        <p className="text-sm" style={{ color: '#94a3b8' }}>{exp.objetivo}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#60a5fa' }}>Tratamentos</p>
                      <div className="flex flex-col gap-1.5">
                        {exp.treatments.map((tr, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.10)' }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                              {tr.label}
                            </div>
                            <span className="text-xs font-semibold text-white flex-1">{tr.description || '—'}</span>
                            {tr.product && <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{tr.product}</span>}
                            {tr.dose && <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>{tr.dose}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-xs font-bold" style={{ color: sp.color }}>{sp.power}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{sp.design}</p>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {exp.treatments.length} × {exp.repetitions} = {exp.treatments.length * exp.repetitions} parcelas
                      </p>
                    </div>

                    {/* ANOVA + Tukey */}
                    <AnovaPanel exp={exp} />

                    {/* Exportar relatório sem ANOVA */}
                    <button
                      onClick={() => exportResearchReport(exp, null)}
                      className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <span className="material-symbols-outlined text-sm">description</span>
                      Exportar planejamento (.txt)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── GxE Tab ───────────────────────────────────────────────────────────────────
interface GxEResult {
  grand_mean: number;
  genotypes: { genotype: string; mean: number; bi: number; s2di: number; classification: string; rank: number }[];
  environments: { environment: string; mean: number; index: number; type: string }[];
  interaction_summary: string;
  recommendation: { best_overall: string | null; stable: string[]; favorable_environments: string[]; unfavorable_environments: string[] };
}

function GxETab() {
  const [environments, setEnvironments] = useState<string[]>(['Loc 1', 'Loc 2', 'Loc 3']);
  const [genotypes, setGenotypes] = useState<string[]>(['Genótipo A', 'Genótipo B', 'Genótipo C']);
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>({});
  const [newEnv, setNewEnv] = useState('');
  const [newGeno, setNewGeno] = useState('');
  const [result, setResult] = useState<GxEResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCellValue = (geno: string, env: string, val: string) => {
    setMatrix(prev => ({
      ...prev,
      [geno]: { ...(prev[geno] ?? {}), [env]: val },
    }));
  };

  const addEnvironment = () => {
    const name = newEnv.trim();
    if (!name || environments.includes(name)) return;
    setEnvironments(prev => [...prev, name]);
    setNewEnv('');
  };

  const addGenotype = () => {
    const name = newGeno.trim();
    if (!name || genotypes.includes(name)) return;
    setGenotypes(prev => [...prev, name]);
    setNewGeno('');
  };

  const removeEnvironment = (env: string) => setEnvironments(prev => prev.filter(e => e !== env));
  const removeGenotype = (geno: string) => setGenotypes(prev => prev.filter(g => g !== geno));

  const runAnalysis = async () => {
    setError(null);
    // Build payload — skip empty cells
    const data: Record<string, Record<string, number>> = {};
    for (const geno of genotypes) {
      const row: Record<string, number> = {};
      for (const env of environments) {
        const raw = matrix[geno]?.[env]?.trim();
        if (raw && !isNaN(Number(raw))) row[env] = Number(raw);
      }
      if (Object.keys(row).length >= 2) data[geno] = row;
    }
    if (Object.keys(data).length < 2) {
      setError('Preencha pelo menos 2 genótipos com dados em 2 ou mais ambientes.'); return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<GxEResult>('/api/stats/gxe', {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular GxE.');
    } finally {
      setLoading(false);
    }
  };

  const CLASS_COLORS: Record<string, string> = {
    'Estável e adaptado': '#4ade80',
    'Responsivo a ambientes favoráveis': '#60a5fa',
    'Adaptado a ambientes desfavoráveis': '#f59e0b',
    'Instável (alta interação)': '#f87171',
    'Comportamento intermediário': '#94a3b8',
  };

  const inpCls = 'w-full px-2 py-1.5 rounded-lg text-xs text-white bg-transparent border focus:outline-none focus:border-[var(--primary)] transition-colors text-center';
  const inpStyle = { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-sm font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ color: '#a78bfa' }}>hub</span>
          Análise GxE — Estabilidade Genotípica
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          Método Eberhart &amp; Russell (1966). Insira os dados de produtividade por ambiente e calcule estabilidade, responsividade e adaptabilidade.
        </p>
      </div>

      {/* Add environments */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Ambientes / Locais</p>
        <div className="flex items-center gap-2 flex-wrap">
          {environments.map(env => (
            <span key={env} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
              {env}
              <button onClick={() => removeEnvironment(env)} className="ml-0.5 hover:opacity-60">✕</button>
            </span>
          ))}
          <input
            className="px-2 py-1 rounded-lg text-xs text-white border focus:outline-none focus:border-[#60a5fa]"
            style={inpStyle} placeholder="+ Novo local" value={newEnv}
            onChange={e => setNewEnv(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEnvironment()}
          />
          <button onClick={addEnvironment}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
            Adicionar
          </button>
        </div>
      </div>

      {/* Add genotypes */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Genótipos / Materiais</p>
        <div className="flex items-center gap-2 flex-wrap">
          {genotypes.map(g => (
            <span key={g} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>
              {g}
              <button onClick={() => removeGenotype(g)} className="ml-0.5 hover:opacity-60">✕</button>
            </span>
          ))}
          <input
            className="px-2 py-1 rounded-lg text-xs text-white border focus:outline-none focus:border-[#a78bfa]"
            style={inpStyle} placeholder="+ Novo genótipo" value={newGeno}
            onChange={e => setNewGeno(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGenotype()}
          />
          <button onClick={addGenotype}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
            Adicionar
          </button>
        </div>
      </div>

      {/* Data matrix */}
      {genotypes.length > 0 && environments.length > 0 && (
        <div className="rounded-2xl border overflow-x-auto" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.09)' }}>
          <table className="w-full min-w-[400px] text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="px-3 py-2.5 text-left font-bold" style={{ color: '#94a3b8' }}>Genótipo</th>
                {environments.map(env => (
                  <th key={env} className="px-2 py-2.5 text-center font-bold" style={{ color: '#60a5fa' }}>{env}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {genotypes.map((geno, gi) => (
                <tr key={geno} style={{ borderTop: gi > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <td className="px-3 py-1.5 font-semibold" style={{ color: '#a78bfa', minWidth: 120 }}>{geno}</td>
                  {environments.map(env => (
                    <td key={env} className="px-2 py-1.5" style={{ minWidth: 80 }}>
                      <input
                        type="number"
                        className={inpCls}
                        style={inpStyle}
                        placeholder="—"
                        value={matrix[geno]?.[env] ?? ''}
                        onChange={e => setCellValue(geno, env, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px]" style={{ color: '#475569' }}>Insira os valores de produtividade (sc/ha, t/ha, kg/ha, etc.) para cada combinação</p>
          </div>
        </div>
      )}

      {/* Run button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => void runAnalysis()}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}
        >
          {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
          <span className="material-symbols-outlined text-base">hub</span>
          {loading ? 'Calculando...' : 'Calcular GxE'}
        </button>
        {result && (
          <button onClick={() => setResult(null)}
            className="px-4 py-3 rounded-xl text-xs font-semibold hover:bg-white/5 transition-all"
            style={{ color: '#64748b', border: '1px solid var(--border)' }}>
            Limpar resultado
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <span className="material-symbols-outlined text-sm">error</span>{error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="p-4 rounded-2xl" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#a78bfa' }}>Resumo da Análise</p>
            <p className="text-xs leading-relaxed" style={{ color: '#cbd5e1' }}>{result.interaction_summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.recommendation.best_overall && (
                <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                  🏆 Maior média: {result.recommendation.best_overall}
                </span>
              )}
              {result.recommendation.stable.map(g => (
                <span key={g} className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                  🎯 Estável: {g}
                </span>
              ))}
            </div>
          </div>

          {/* Genotype rankings */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.09)' }}>
            <div className="px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>Ranking por Estabilidade</p>
            </div>
            {result.genotypes.map((g, i) => (
              <div key={g.genotype} className="px-4 py-3 flex items-center gap-4"
                style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                <span className="text-lg font-black w-6 text-center" style={{ color: i === 0 ? '#f59e0b' : '#334155' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${g.rank}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{g.genotype}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: CLASS_COLORS[g.classification] + '20', color: CLASS_COLORS[g.classification] ?? '#94a3b8' }}>
                      {g.classification}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-right flex-shrink-0">
                  <div>
                    <p className="text-[9px] uppercase" style={{ color: '#475569' }}>Média</p>
                    <p className="text-sm font-bold text-white">{g.mean.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase" style={{ color: '#475569' }}>bi</p>
                    <p className="text-sm font-bold" style={{ color: g.bi > 1.15 ? '#60a5fa' : g.bi < 0.85 ? '#f59e0b' : '#4ade80' }}>{g.bi.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase" style={{ color: '#475569' }}>S²di</p>
                    <p className="text-sm font-bold" style={{ color: g.s2di < 0.5 ? '#4ade80' : '#f87171' }}>{g.s2di.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Environments */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.environments.map(env => (
              <div key={env.environment} className="p-3 rounded-xl flex flex-col gap-1"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">{env.environment}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={env.type === 'Favorável'
                      ? { background: 'rgba(74,222,128,0.12)', color: '#4ade80' }
                      : { background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                    {env.type}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#94a3b8' }}>Média: <strong className="text-white">{env.mean.toFixed(2)}</strong></p>
                <p className="text-[10px]" style={{ color: '#475569' }}>Índice: {env.index >= 0 ? '+' : ''}{env.index.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Avaliações Fenotípicas Tab ─────────────────────────────────────────────────

const AV_KEY = 'tracto-avaliacoes-v1';

interface TraitCustom { label: string; value: string }
interface Avaliacao {
  id: string;
  genotipo: string;
  experimento: string;
  parcela: string;
  data: string;
  // Traits padrão
  alt_planta: string;
  alt_espiga: string;
  cor_pendao: string;
  largura_folha: string;
  diam_colmo: string;
  dias_florescimento_m: string;
  dias_florescimento_f: string;
  nota_visual: string;
  nota_doencas: string;
  acamamento: string;
  quebramento: string;
  stand_plantas: string;    // plantas por metro linear
  dominadas: string;        // % plantas dominadas/atrasadas
  fileiras_graos: string;
  notas: string;
  traits_custom: TraitCustom[];
  fotos_analise: string;   // texto livre com resultado da análise IA das fotos
  createdAt: string;
}

const loadAvaliacoes = (): Avaliacao[] => {
  try { return JSON.parse(localStorage.getItem(AV_KEY) ?? '[]'); } catch { return []; }
};
const saveAvaliacoes = (d: Avaliacao[]) => {
  try { localStorage.setItem(AV_KEY, JSON.stringify(d)); } catch { /**/ }
};

const COR_PENDAO = ['Amarelo claro','Amarelo','Amarelo escuro','Roxo claro','Roxo','Rosado','Branco'];
const NOTAS_OPTIONS = ['1','2','3','4','5','6','7','8','9'];

const AV_INP = 'w-full px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none focus:border-[var(--primary)] transition-colors';
const AV_STYLE = { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' };
const AV_LBL = 'text-[10px] font-bold uppercase tracking-widest mb-1 block';

function AvaliacaoTab() {
  const [list, setList] = useState<Avaliacao[]>(loadAvaliacoes);
  const [showForm, setShowForm] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<{ base64: string; mime: string; name: string }[]>([]);
  const [filterGeno, setFilterGeno] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<string | null>(null);

  const genotypes: { id: string; name: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem('tracto-germoplasma-v1') ?? '[]'); } catch { return []; }
  })();
  const experiments: { id: string; name: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem('tracto-experiments-v1') ?? '[]'); } catch { return []; }
  })();

  const emptyForm = (): Omit<Avaliacao,'id'|'createdAt'|'fotos_analise'> => ({
    genotipo:'', experimento:'', parcela:'', data: new Date().toISOString().split('T')[0],
    alt_planta:'', alt_espiga:'', cor_pendao:'Amarelo', largura_folha:'',
    diam_colmo:'', dias_florescimento_m:'', dias_florescimento_f:'',
    nota_visual:'', nota_doencas:'', acamamento:'', quebramento:'',
    stand_plantas:'', dominadas:'',
    fileiras_graos:'', notas:'', traits_custom:[],
  });
  const [form, setForm] = useState(emptyForm());
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const addCustomTrait = () => {
    if (!customKey.trim()) return;
    setForm(p => ({ ...p, traits_custom: [...p.traits_custom, { label: customKey.trim(), value: customVal }] }));
    setCustomKey(''); setCustomVal('');
  };

  const removeCustomTrait = (i: number) => {
    setForm(p => ({ ...p, traits_custom: p.traits_custom.filter((_, idx) => idx !== i) }));
  };

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const allowed = ['image/jpeg','image/png','image/webp'];
    const valid = files.filter(f => allowed.includes(f.type) && f.size <= 8 * 1024 * 1024).slice(0, 10);
    const results = await Promise.all(valid.map(file =>
      new Promise<{ base64: string; mime: string; name: string }>((res, rej) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => res({ base64: (r.result as string).split(',')[1], mime: file.type, name: file.name });
        r.onerror = rej;
      })
    ));
    setPendingPhotos(prev => [...prev, ...results].slice(0, 10));
    e.target.value = '';
  };

  const save = () => {
    if (!form.genotipo.trim()) return;
    const newAv: Avaliacao = { ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString(), fotos_analise: '' };
    const updated = [newAv, ...list];
    setList(updated); saveAvaliacoes(updated);
    setForm(emptyForm()); setPendingPhotos([]); setShowForm(false);
  };

  const del = (id: string) => {
    if (!window.confirm('Excluir esta avaliação?')) return;
    const updated = list.filter(a => a.id !== id);
    setList(updated); saveAvaliacoes(updated);
  };

  // Detecção automática de traits por foto (preenche o formulário automaticamente)
  const detectTraitsFromPhoto = async () => {
    if (pendingPhotos.length === 0) return;
    setDetecting(true);
    setDetectNote(null);
    const photo = pendingPhotos[0];
    try {
      const { apiFetch } = await import('../services/api');
      interface ChatReply { reply: string }
      const res = await apiFetch<ChatReply>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          field_id: 'phenotype-detection',
          messages: [{
            role: 'user',
            text: `Você é um especialista em avaliação fenotípica de milho, sorgo e cereais. Analise esta foto de parcela experimental e estime os parâmetros abaixo. Responda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois:

{
  "alt_planta_cm": <altura da planta até o final do pendão em cm, ou null>,
  "alt_espiga_cm": <altura de inserção da espiga em cm, ou null>,
  "cor_pendao": <"Amarelo" | "Roxo" | "Amarelo-Roxo" | "Branco" | null>,
  "acamamento_pct": <% plantas com colmo deitado no solo, 0-100, ou null>,
  "quebramento_pct": <% colmos quebrados abaixo da espiga, 0-100, ou null>,
  "stand_plantas_metro": <número médio de plantas por metro linear visível, ou null>,
  "dominadas_pct": <% plantas visivelmente menores/atrasadas em relação à média da parcela, 0-100, ou null>,
  "nota_visual": <nota geral de aspecto da parcela de 1 a 9 sendo 9 excelente, ou null>,
  "nota_doencas": <nota de sanidade foliar de 1 a 9 sendo 9 sem doenças, ou null>,
  "obs": "<observações importantes: uniformidade, sintomas visíveis, estágio fenológico, presença de referência de escala na foto>"
}

IMPORTANTE: se não houver referência de escala visível (pessoa, régua, bitola), estime a altura com base na proporção visual e mencione isso em obs. Seja conservador — prefira null a um número muito incerto.`,
          }],
          image_base64: photo.base64,
          image_mime_type: photo.mime,
          user_profile: 'pesquisador',
        }),
      });

      // Extrai JSON da resposta
      const jsonMatch = res.reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('resposta sem JSON');
      const d = JSON.parse(jsonMatch[0]);

      // Preenche o formulário com os valores detectados (preserva o que o usuário já digitou)
      setForm(prev => {
        const next = { ...prev };
        if (d.alt_planta_cm != null)      next.alt_planta  = String(d.alt_planta_cm);
        if (d.alt_espiga_cm != null)      next.alt_espiga  = String(d.alt_espiga_cm);
        if (d.cor_pendao)                 next.cor_pendao  = d.cor_pendao;
        if (d.acamamento_pct != null)     next.acamamento  = String(d.acamamento_pct);
        if (d.quebramento_pct != null)    next.quebramento = String(d.quebramento_pct);
        if (d.stand_plantas_metro != null) next.stand_plantas = String(d.stand_plantas_metro);
        if (d.dominadas_pct != null)      next.dominadas   = String(d.dominadas_pct);
        if (d.nota_visual != null)        next.nota_visual  = String(d.nota_visual);
        if (d.nota_doencas != null)       next.nota_doencas = String(d.nota_doencas);
        return next;
      });

      const filled = [
        d.alt_planta_cm   != null && 'alt. planta',
        d.alt_espiga_cm   != null && 'inserção espiga',
        d.cor_pendao               && 'cor pendão',
        d.acamamento_pct  != null && 'acamamento',
        d.quebramento_pct != null && 'quebramento',
        d.stand_plantas_metro != null && 'stand',
        d.dominadas_pct   != null && 'dominadas',
        d.nota_visual     != null && 'nota visual',
        d.nota_doencas    != null && 'nota doenças',
      ].filter(Boolean).join(', ');

      setDetectNote(`✅ Preenchido automaticamente: ${filled || 'nenhum campo detectado'}${d.obs ? `\n📷 ${d.obs}` : ''}`);
    } catch {
      setDetectNote('⚠️ Não foi possível extrair dados estruturados. Tente uma foto mais clara com boa iluminação e visibilidade das plantas.');
    } finally {
      setDetecting(false);
    }
  };

  // Análise IA com fotos (envia para MelhorIA via /api/chat)
  const analyzeWithAI = async (av: Avaliacao, photosToSend?: { base64: string; mime: string; name: string }[]) => {
    setAnalyzingId(av.id);
    try {
      const { apiFetch } = await import('../services/api');
      const traitText = [
        `Genótipo: ${av.genotipo}`,
        `Experimento: ${av.experimento || '—'}  |  Parcela: ${av.parcela || '—'}`,
        `Data de avaliação: ${av.data}`,
        av.alt_planta       ? `Altura de planta: ${av.alt_planta} cm` : '',
        av.alt_espiga       ? `Altura de inserção de espiga: ${av.alt_espiga} cm` : '',
        av.cor_pendao       ? `Cor de pendão: ${av.cor_pendao}` : '',
        av.largura_folha    ? `Largura de folha: ${av.largura_folha} cm` : '',
        av.diam_colmo       ? `Diâmetro de colmo: ${av.diam_colmo} mm` : '',
        av.dias_florescimento_m ? `Florescimento masculino: ${av.dias_florescimento_m} DAE` : '',
        av.dias_florescimento_f ? `Florescimento feminino (espigamento): ${av.dias_florescimento_f} DAE` : '',
        av.nota_visual      ? `Nota visual geral: ${av.nota_visual}/9` : '',
        av.nota_doencas     ? `Nota de doenças: ${av.nota_doencas}/9` : '',
        av.acamamento       ? `Acamamento: ${av.acamamento}%` : '',
        av.quebramento      ? `Quebramento: ${av.quebramento}%` : '',
        av.stand_plantas    ? `Stand de plantas: ${av.stand_plantas} plantas/metro` : '',
        av.dominadas        ? `Plantas dominadas: ${av.dominadas}%` : '',
        av.fileiras_graos   ? `Fileiras de grãos: ${av.fileiras_graos}` : '',
        ...av.traits_custom.map(t => `${t.label}: ${t.value}`),
        av.notas            ? `Observações: ${av.notas}` : '',
      ].filter(Boolean).join('\n');

      // If photos provided, send first photo via existing vision endpoint
      const photo = photosToSend?.[0];

      // Get active field id (use first available or fallback)
      const store = (await import('../store/useAppStore')).default.getState();
      const fieldId = store.activeFieldId ?? store.fields[0]?.id ?? 'unknown';

      interface ChatReply { reply: string }
      const data = await apiFetch<ChatReply>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          field_id: fieldId,
          messages: [{
            role: 'user',
            text: `Analise a seguinte avaliação fenotípica de campo:\n\n${traitText}\n\n${photo ? 'Analise também a foto da parcela que está sendo enviada. ' : ''}Forneça: (1) avaliação do desempenho agronômico desta linhagem, (2) pontos de atenção ou destaques, (3) recomendação para seleção/descarte com base nos dados apresentados.`,
          }],
          farm_context: traitText,
          image_base64: photo?.base64 ?? null,
          image_mime_type: photo?.mime ?? 'image/jpeg',
          user_profile: 'pesquisador',
          research_context: localStorage.getItem('tracto-germoplasma-v1')
            ? `Germoplasma da empresa:\n${localStorage.getItem('tracto-germoplasma-v1')}`
            : null,
        }),
      });

      // Save analysis result back to evaluation
      const updated = list.map(a =>
        a.id === av.id ? { ...a, fotos_analise: data.reply } : a
      );
      setList(updated); saveAvaliacoes(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na análise';
      const updated = list.map(a => a.id === av.id ? { ...a, fotos_analise: `Erro: ${msg}` } : a);
      setList(updated); saveAvaliacoes(updated);
    } finally {
      setAnalyzingId(null);
    }
  };

  const filtered = filterGeno
    ? list.filter(a => a.genotipo.toLowerCase().includes(filterGeno.toLowerCase()))
    : list;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: '#a78bfa' }}>biotech</span>
            Avaliações Fenotípicas
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Registre altura de planta, cor de pendão, inserção de espiga, sanidade, fotos e qualquer característica agronômica por parcela.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: showForm ? 'rgba(255,255,255,0.08)' : 'var(--primary)' }}>
          <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Nova Avaliação'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border flex flex-col gap-5 p-5" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.09)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Nova Avaliação de Campo</p>

          {/* Identificação */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={AV_LBL} style={{ color: '#a78bfa' }}>Genótipo / Material *</label>
              {genotypes.length > 0
                ? <select className={AV_INP} style={{ ...AV_STYLE, background: '#1e293b' }} value={form.genotipo} onChange={e => f('genotipo', e.target.value)}>
                    <option value="">— Selecione —</option>
                    {genotypes.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                : <input className={AV_INP} style={AV_STYLE} placeholder="Nome do genótipo" value={form.genotipo} onChange={e => f('genotipo', e.target.value)} />
              }
            </div>
            <div>
              <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Experimento</label>
              {experiments.length > 0
                ? <select className={AV_INP} style={{ ...AV_STYLE, background: '#1e293b' }} value={form.experimento} onChange={e => f('experimento', e.target.value)}>
                    <option value="">— Selecione —</option>
                    {experiments.map(x => <option key={x.id} value={x.name}>{x.name}</option>)}
                  </select>
                : <input className={AV_INP} style={AV_STYLE} placeholder="Nome do experimento" value={form.experimento} onChange={e => f('experimento', e.target.value)} />
              }
            </div>
            <div>
              <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Parcela / Bloco</label>
              <input className={AV_INP} style={AV_STYLE} placeholder="Ex: Bloco 12 / Parcela 3A" value={form.parcela} onChange={e => f('parcela', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Data da Avaliação</label>
              <input type="date" className={AV_INP} style={AV_STYLE} value={form.data} onChange={e => f('data', e.target.value)} />
            </div>
          </div>

          {/* Traits morfológicos */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#60a5fa' }}>Características Morfológicas</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Altura de planta (cm)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Ex: 230" value={form.alt_planta} onChange={e => f('alt_planta', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Altura inserção espiga (cm)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Ex: 115" value={form.alt_espiga} onChange={e => f('alt_espiga', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: '#f472b6' }}>Cor do pendão</label>
                <select className={AV_INP} style={{ ...AV_STYLE, background: '#1e293b' }} value={form.cor_pendao} onChange={e => f('cor_pendao', e.target.value)}>
                  {COR_PENDAO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Largura de folha (cm)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Ex: 9.5" step="0.1" value={form.largura_folha} onChange={e => f('largura_folha', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Diâmetro de colmo (mm)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Ex: 22" step="0.1" value={form.diam_colmo} onChange={e => f('diam_colmo', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Fileiras de grãos</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Ex: 16" value={form.fileiras_graos} onChange={e => f('fileiras_graos', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Florescimento */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#4ade80' }}>Florescimento</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Florescimento masculino (DAE)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Dias após emergência" value={form.dias_florescimento_m} onChange={e => f('dias_florescimento_m', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Espigamento / flor. feminino (DAE)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Dias após emergência" value={form.dias_florescimento_f} onChange={e => f('dias_florescimento_f', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Notas e sanidade */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#f59e0b' }}>Notas Agronômicas (1 = ruim → 9 = excelente)</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Nota visual</label>
                <select className={AV_INP} style={{ ...AV_STYLE, background: '#1e293b' }} value={form.nota_visual} onChange={e => f('nota_visual', e.target.value)}>
                  <option value="">—</option>
                  {NOTAS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Nota doenças</label>
                <select className={AV_INP} style={{ ...AV_STYLE, background: '#1e293b' }} value={form.nota_doencas} onChange={e => f('nota_doencas', e.target.value)}>
                  <option value="">—</option>
                  {NOTAS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Stand de plantas (plantas/metro)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="Ex: 4.5" step="0.1" min="0" value={form.stand_plantas} onChange={e => f('stand_plantas', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Acamamento (%)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="0–100" min="0" max="100" value={form.acamamento} onChange={e => f('acamamento', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Quebramento (%)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="0–100" min="0" max="100" value={form.quebramento} onChange={e => f('quebramento', e.target.value)} />
              </div>
              <div>
                <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Plantas dominadas (%)</label>
                <input type="number" className={AV_INP} style={AV_STYLE} placeholder="0–100" min="0" max="100" value={form.dominadas} onChange={e => f('dominadas', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Custom traits */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>Características Personalizadas</p>
            {form.traits_custom.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.traits_custom.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
                    <strong>{t.label}:</strong> {t.value}
                    <button onClick={() => removeCustomTrait(i)} className="ml-1 hover:opacity-60">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <input className="flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm text-white border focus:outline-none focus:border-[var(--primary)]"
                style={AV_STYLE} placeholder="Característica (ex: Cor do grão)" value={customKey} onChange={e => setCustomKey(e.target.value)} />
              <input className="w-32 px-3 py-2 rounded-xl text-sm text-white border focus:outline-none focus:border-[var(--primary)]"
                style={AV_STYLE} placeholder="Valor" value={customVal} onChange={e => setCustomVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomTrait()} />
              <button onClick={addCustomTrait}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>
                + Adicionar
              </button>
            </div>
          </div>

          {/* Fotos + Detecção Automática */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fb923c' }}>
                Fotos da Parcela ({pendingPhotos.length}/10)
              </p>
              {pendingPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={detectTraitsFromPhoto}
                  disabled={detecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90 transition-all"
                  style={{ background: detecting ? 'rgba(167,139,250,0.3)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}
                >
                  {detecting
                    ? <><span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />Detectando campos...</>
                    : <><span className="material-symbols-outlined text-sm">auto_awesome</span>Detectar campos automaticamente</>
                  }
                </button>
              )}
            </div>

            <label className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:opacity-80 w-fit"
              style={{ background: 'rgba(251,146,60,0.1)', border: '1px dashed rgba(251,146,60,0.4)', color: '#fb923c' }}>
              <span className="material-symbols-outlined text-base">add_photo_alternate</span>
              <span className="text-xs font-semibold">Selecionar fotos (JPG/PNG/WEBP, máx 8MB cada)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotos} />
            </label>

            {pendingPhotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {pendingPhotos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={`data:${p.mime};base64,${p.base64}`} alt={p.name}
                      className="w-20 h-20 rounded-xl object-cover"
                      style={{ border: i === 0 ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)' }} />
                    {i === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold rounded-b-xl py-0.5" style={{ background: 'rgba(124,58,237,0.8)', color: '#fff' }}>
                        detecção
                      </span>
                    )}
                    <button onClick={() => setPendingPhotos(prev => prev.filter((_,idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                      style={{ background: '#ef4444', color: '#fff' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Resultado da detecção */}
            {detectNote && (
              <div className="p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap"
                style={{
                  background: detectNote.startsWith('✅') ? 'rgba(74,222,128,0.08)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${detectNote.startsWith('✅') ? 'rgba(74,222,128,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  color: detectNote.startsWith('✅') ? '#4ade80' : '#f59e0b',
                }}>
                {detectNote}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className={AV_LBL} style={{ color: 'var(--muted)' }}>Observações gerais</label>
            <textarea className={AV_INP} style={{ ...AV_STYLE, resize: 'vertical' }} rows={2}
              placeholder="Observações livres sobre a parcela..."
              value={form.notas} onChange={e => f('notas', e.target.value)} />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={save}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <span className="material-symbols-outlined text-sm">save</span>
              Salvar Avaliação
            </button>
            {pendingPhotos.length > 0 && (
              <p className="text-xs flex items-center gap-1" style={{ color: '#f59e0b' }}>
                <span className="material-symbols-outlined text-sm">info</span>
                Salve primeiro, depois clique "Analisar com MelhorIA" no card.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filter + list */}
      {list.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none focus:border-[var(--primary)]"
            style={AV_STYLE} placeholder="Filtrar por genótipo..."
            value={filterGeno} onChange={e => setFilterGeno(e.target.value)}
          />
          <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>{filtered.length} avaliação{filtered.length !== 1 ? 'ões' : ''}</span>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: '#1e293b' }}>biotech</span>
          <p className="text-sm font-bold text-white">Nenhuma avaliação registrada</p>
          <p className="text-xs text-center px-8" style={{ color: 'var(--muted)' }}>
            Registre altura de planta, cor de pendão, notas de doenças, fotos e muito mais por parcela. A MelhorIA analisa tudo.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {filtered.map(av => {
          const isAnalyzing = analyzingId === av.id;
          return (
            <div key={av.id} className="rounded-2xl border overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{av.genotipo}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {av.experimento && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>{av.experimento}</span>}
                    {av.parcela    && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>{av.parcela}</span>}
                    <span className="text-[10px]" style={{ color: '#475569' }}>{new Date(av.data + 'T12:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => void analyzeWithAI(av)}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                    {isAnalyzing
                      ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Analisando...</>
                      : <><span className="material-symbols-outlined text-sm">smart_toy</span>MelhorIA</>
                    }
                  </button>
                  <button onClick={() => del(av.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: '#f87171' }}>
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>

              {/* Traits grid */}
              <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Alt. Planta', value: av.alt_planta ? `${av.alt_planta} cm` : null },
                  { label: 'Alt. Espiga', value: av.alt_espiga ? `${av.alt_espiga} cm` : null },
                  { label: 'Cor Pendão',  value: av.cor_pendao || null },
                  { label: 'Largura Folha', value: av.largura_folha ? `${av.largura_folha} cm` : null },
                  { label: 'Diâm. Colmo', value: av.diam_colmo ? `${av.diam_colmo} mm` : null },
                  { label: 'Flor. ♂',    value: av.dias_florescimento_m ? `${av.dias_florescimento_m} DAE` : null },
                  { label: 'Flor. ♀',    value: av.dias_florescimento_f ? `${av.dias_florescimento_f} DAE` : null },
                  { label: 'Nota Visual', value: av.nota_visual ? `${av.nota_visual}/9` : null },
                  { label: 'Nota Doenças', value: av.nota_doencas ? `${av.nota_doencas}/9` : null },
                  { label: 'Acamamento', value: av.acamamento ? `${av.acamamento}%` : null },
                  { label: 'Quebramento', value: av.quebramento ? `${av.quebramento}%` : null },
                  { label: 'Fileiras',    value: av.fileiras_graos || null },
                  ...av.traits_custom.map(t => ({ label: t.label, value: t.value })),
                ].filter(t => t.value).map(t => (
                  <div key={t.label} className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: '#475569' }}>{t.label}</span>
                    <span className="text-xs font-semibold text-white">{t.value}</span>
                  </div>
                ))}
              </div>

              {av.notas && (
                <div className="px-4 pb-3">
                  <p className="text-xs italic" style={{ color: '#64748b' }}>📝 {av.notas}</p>
                </div>
              )}

              {/* AI Analysis result */}
              {av.fotos_analise && (
                <div className="mx-4 mb-4 p-4 rounded-xl"
                  style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>
                    🧬 Análise MelhorIA
                  </p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>
                    {av.fotos_analise}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type ResearchTab = 'blocos' | 'experimentos' | 'gxe' | 'avaliacoes';

export default function Research() {
  const navigate = useNavigate();
  const { farms, fields } = useAppStore();

  const [researchTab, setResearchTab] = useState<ResearchTab>('blocos');
  const [entries, setEntries] = useState<Record<string, ResearchEntry>>(loadAll);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | 'crescendo' | 'floresceu' | 'previsto'>('todos');
  const [gddCache, setGddCache] = useState<Record<string, GDDData>>({});
  const [gddLoadingMap, setGddLoading] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');
  const [gddLastUpdate, setGddLastUpdate] = useState<string | null>(null);
  const [expandedFenologia, setExpandedFenologia] = useState<string | null>(null);
  const [expandedNdvi, setExpandedNdvi] = useState<string | null>(null);

  const isGddLoading = Object.values(gddLoadingMap).some(Boolean);

  // Auto-load GDD/temperature data for all fields with planting dates
  useEffect(() => {
    const fieldsNeedingGDD = fields.filter(f => f.dataPlantio && f.id && !gddCache[f.id]);
    if (fieldsNeedingGDD.length === 0) return;

    fieldsNeedingGDD.slice(0, 5).forEach(async (f) => {
      if (!f.id || !f.dataPlantio) return;
      setGddLoading(prev => ({ ...prev, [f.id!]: true }));
      try {
        const data = await fetchTemperatureHistory(f.lat, f.lng, f.dataPlantio);
        setGddCache(prev => ({ ...prev, [f.id!]: data }));
        setGddLastUpdate(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
      } catch { /* silently skip */ }
      finally {
        setGddLoading(prev => ({ ...prev, [f.id!]: false }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const handleSave = (entry: ResearchEntry) => {
    saveEntry(entry);
    setEntries(loadAll());
    setEditingId(null);
  };

  const handleClearActual = (fieldId: string) => {
    const e = loadEntry(fieldId);
    saveEntry({ ...e, floweringDateActual: undefined });
    setEntries(loadAll());
  };

  // Aggregate stats
  const today = todayISO();
  const allFields = fields;
  const totalWithData = allFields.filter(f => f.id && entries[f.id]).length;
  const floweringThisWeek = allFields.filter(f => {
    if (!f.id) return false;
    const e = entries[f.id];
    if (!e?.daysToFlowering || !f.dataPlantio) return false;
    const predicted = addDays(f.dataPlantio, e.daysToFlowering);
    const diff = daysBetween(today, predicted);
    return diff >= 0 && diff <= 7;
  }).length;
  const alreadyFlowered = allFields.filter(f => f.id && entries[f.id]?.floweringDateActual).length;

  // Filter fields
  const filteredFields = useMemo(() => allFields.filter(f => {
    if (!f.id) return false;
    const e = entries[f.id] ?? {};
    const predicted = e.daysToFlowering && f.dataPlantio ? addDays(f.dataPlantio, e.daysToFlowering) : null;
    const status = getFlowerStatus(f.dataPlantio, predicted, e.floweringDateActual);
    if (filter === 'todos') return true;
    if (filter === 'crescendo') return status === 'crescendo' || status === 'sem_plantio';
    if (filter === 'floresceu') return status === 'floresceu';
    if (filter === 'previsto') return status === 'previsto' || status === 'florescimento_hoje';
    return true;
  }), [allFields, entries, filter]);

  // Timeline items
  const timelineItems: TimelineItem[] = useMemo(() => allFields.map(f => {
    const e = entries[f.id ?? ''] ?? {};
    const farm = farms.find(fm => fm.id === f.farm_id);
    const predictedDate = e.daysToFlowering && f.dataPlantio
      ? addDays(f.dataPlantio, e.daysToFlowering)
      : null;
    return {
      fieldId: f.id ?? '',
      fieldName: f.name ?? 'Talhão',
      farmName: farm?.name ?? '',
      variedade: f.variedade,
      plantingDate: f.dataPlantio,
      predictedDate,
      actualDate: e.floweringDateActual,
    };
  }).filter(i => i.predictedDate || i.actualDate), [allFields, entries, farms]);

  const groupedByFarm = useMemo(() => {
    const map = new Map<string, { farm: typeof farms[0]; fields: typeof fields }>();
    for (const farm of farms) {
      const farmFields = filteredFields.filter(f => f.farm_id === farm.id);
      if (farmFields.length > 0) map.set(farm.id, { farm, fields: farmFields });
    }
    // Also include fields without farm
    const noFarm = filteredFields.filter(f => !f.farm_id);
    if (noFarm.length > 0) map.set('__no_farm__', { farm: { id: '__no_farm__', name: 'Sem fazenda', fields: [] }, fields: noFarm });
    return map;
  }, [farms, filteredFields]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>biotech</span>
              <h1 className="text-2xl font-black text-white">Pesquisa Agronômica</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Estande de planta, florescimento, soma térmica e experimentos comparativos.
            </p>
          </div>
          {researchTab === 'blocos' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(v => v === 'cards' ? 'timeline' : 'cards')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
                style={{ color: '#94a3b8', border: '1px solid var(--border)' }}
              >
                <span className="material-symbols-outlined text-base">{viewMode === 'cards' ? 'timeline' : 'grid_view'}</span>
                {viewMode === 'cards' ? 'Ver Timeline' : 'Ver Blocos'}
              </button>
              <button
                onClick={() => exportCSV(allFields, farms, entries)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
              >
                <span className="material-symbols-outlined text-base">download</span>
                Exportar CSV
              </button>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-thin" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {([
            { id: 'blocos' as ResearchTab, label: 'Blocos / Parcelas', icon: 'grid_view' },
            { id: 'experimentos' as ResearchTab, label: 'Experimentos', icon: 'science' },
            { id: 'gxe' as ResearchTab, label: 'Análise GxE', icon: 'hub' },
            { id: 'avaliacoes' as ResearchTab, label: 'Avaliações Fenotípicas', icon: 'biotech', badge: 'NOVO' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setResearchTab(tab.id)}
              className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={researchTab === tab.id
                ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
              {tab.badge && researchTab !== tab.id && (
                <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Experimentos tab */}
        {researchTab === 'experimentos' && <ExperimentsTab />}

        {/* GxE tab */}
        {researchTab === 'gxe' && <GxETab />}

        {/* Avaliações Fenotípicas tab */}
        {researchTab === 'avaliacoes' && <AvaliacaoTab />}

        {/* Blocos tab content below */}
        {researchTab === 'blocos' && (<>

        {/* Auto-analysis status banner */}
        {isGddLoading ? (
          <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: 'rgba(236,91,19,0.08)', border: '1px solid rgba(236,91,19,0.2)' }}>
            <span className="material-symbols-outlined shrink-0 animate-spin text-lg" style={{ color: '#ec5b13' }}>progress_activity</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#ec5b13' }}>Carregando soma térmica automática...</p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>Buscando histórico de temperatura (Open-Meteo) para calcular GDD e prever florescimento.</p>
            </div>
          </div>
        ) : gddLastUpdate ? (
          <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <span className="material-symbols-outlined shrink-0 text-lg" style={{ color: '#4ade80' }}>thermostat</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>Soma térmica (GDD) atualizada automaticamente</p>
              <p className="text-xs" style={{ color: '#94a3b8' }}>Dados meteorológicos carregados · Previsão de florescimento calculada · {gddLastUpdate}</p>
            </div>
          </div>
        ) : null}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: 'grid_view',      label: 'Total de blocos',        value: allFields.length,      color: '#94a3b8' },
            { icon: 'edit_note',      label: 'Com dados registrados',  value: totalWithData,         color: '#60a5fa' },
            { icon: 'local_florist',  label: 'Florescendo esta semana',value: floweringThisWeek,     color: '#fb923c' },
            { icon: 'done_all',       label: 'Já floresceram',         value: alreadyFlowered,       color: '#4ade80' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-base" style={{ color: s.color }}>{s.icon}</span>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {([
            { id: 'todos',     label: 'Todos',         count: allFields.length },
            { id: 'crescendo', label: 'Crescendo',     count: allFields.filter(f => { const e = entries[f.id ?? ''] ?? {}; const p = e.daysToFlowering && f.dataPlantio ? addDays(f.dataPlantio, e.daysToFlowering) : null; return ['crescendo','sem_plantio'].includes(getFlowerStatus(f.dataPlantio, p, e.floweringDateActual)); }).length },
            { id: 'previsto',  label: 'Prev. floresc.',count: allFields.filter(f => { const e = entries[f.id ?? ''] ?? {}; const p = e.daysToFlowering && f.dataPlantio ? addDays(f.dataPlantio, e.daysToFlowering) : null; return ['previsto','florescimento_hoje'].includes(getFlowerStatus(f.dataPlantio, p, e.floweringDateActual)); }).length },
            { id: 'floresceu', label: 'Floresceu',     count: alreadyFlowered },
          ] as { id: typeof filter; label: string; count: number }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={filter === tab.id
                ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }}
            >
              {tab.label}
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {viewMode === 'timeline' ? (
          <FloweringTimeline items={timelineItems} />
        ) : (
          <>
            {allFields.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(236,91,19,0.12)' }}>
                  <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--primary)' }}>biotech</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white mb-1">Nenhum talhão cadastrado</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Crie talhões no mapa para começar a registrar dados de pesquisa.</p>
                </div>
                <button
                  onClick={() => navigate('/app/dashboard')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'var(--primary)' }}
                >
                  <span className="material-symbols-outlined text-base">map</span>
                  Ir para o mapa
                </button>
              </div>
            ) : filteredFields.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>Nenhum bloco corresponde ao filtro selecionado.</p>
            ) : (
              Array.from(groupedByFarm.entries()).map(([farmId, { farm, fields: farmFields }]) => (
                <div key={farmId} className="flex flex-col gap-3">
                  {/* Farm group header */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--primary)' }}>home_work</span>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{farm.name}</p>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <span className="text-[10px]" style={{ color: '#334155' }}>{farmFields.length} bloco{farmFields.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {farmFields.map(field => {
                      const entry = entries[field.id ?? ''] ?? { fieldId: field.id ?? '' };
                      const fid = field.id ?? '';
                      const isFenologiaOpen = expandedFenologia === fid;
                      const isNdviOpen = expandedNdvi === fid;

                      if (editingId === field.id) {
                        return (
                          <div key={field.id} className="sm:col-span-2">
                            <div className="mb-2 px-1">
                              <p className="text-sm font-bold text-white">{field.name}</p>
                            </div>
                            <EditPanel
                              fieldId={fid}
                              initialEntry={entry}
                              onSave={handleSave}
                              onCancel={() => setEditingId(null)}
                            />
                          </div>
                        );
                      }

                      return (
                        <React.Fragment key={fid}>
                          <BlockCard
                            field={field}
                            farmName={farm.name}
                            entry={entry}
                            gddData={gddCache[fid] ?? []}
                            onEdit={() => {
                              setEditingId(fid);
                              setExpandedFenologia(null);
                              setExpandedNdvi(null);
                            }}
                            onClearActual={() => handleClearActual(fid)}
                            onFenologia={() => {
                              setExpandedFenologia(isFenologiaOpen ? null : fid);
                              setExpandedNdvi(null);
                            }}
                            fenologiaActive={isFenologiaOpen}
                          />

                          {/* Fenologia expanded panel (full width) */}
                          {isFenologiaOpen && (
                            <div className="sm:col-span-2">
                              <FenologiaPanel fieldId={fid} fieldName={field.name ?? 'Talhão'} />
                            </div>
                          )}

                          {/* NDVI expanded panel (full width) */}
                          {isNdviOpen && (
                            <div className="sm:col-span-2">
                              <NdviPanel fieldId={fid} lat={field.lat} lng={field.lng} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Tip */}
            {allFields.length > 0 && totalWithData < allFields.length && (
              <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'rgba(236,91,19,0.06)', border: '1px solid rgba(236,91,19,0.15)' }}>
                <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }}>lightbulb</span>
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">Dica</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Clique em <strong className="text-white">✏ editar</strong> em qualquer bloco para registrar o estande (contagem de plantas) e os dias previstos para florescimento. Com a data de plantio já cadastrada, o sistema calcula automaticamente a data prevista.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* End blocos tab */}
        </>)}
      </div>
    </div>
  );
}
