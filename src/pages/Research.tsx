import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

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

// ── Block Card ─────────────────────────────────────────────────────────────────
function BlockCard({
  field,
  farmName,
  entry,
  gddData,
  onEdit,
  onClearActual,
}: {
  field: { id?: string; name?: string; cultura?: string; variedade?: string; dataPlantio?: string; lat: number; lng: number; areaHa?: number };
  farmName: string;
  entry: ResearchEntry;
  gddData: GDDData;
  onEdit: () => void;
  onClearActual: () => void;
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

// ── Main Page ─────────────────────────────────────────────────────────────────
type ResearchTab = 'blocos' | 'experimentos';

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
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {([
            { id: 'blocos' as ResearchTab, label: 'Blocos / Parcelas', icon: 'grid_view' },
            { id: 'experimentos' as ResearchTab, label: 'Experimentos', icon: 'science' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setResearchTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={researchTab === tab.id
                ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Experimentos tab */}
        {researchTab === 'experimentos' && <ExperimentsTab />}

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
                      return editingId === field.id ? (
                        <div key={field.id} className="sm:col-span-2">
                          <div className="mb-2 px-1">
                            <p className="text-sm font-bold text-white">{field.name}</p>
                          </div>
                          <EditPanel
                            fieldId={field.id ?? ''}
                            initialEntry={entry}
                            onSave={handleSave}
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      ) : (
                        <BlockCard
                          key={field.id}
                          field={field}
                          farmName={farm.name}
                          entry={entry}
                          gddData={gddCache[field.id ?? ''] ?? []}
                          onEdit={() => setEditingId(field.id ?? null)}
                          onClearActual={() => handleClearActual(field.id ?? '')}
                        />
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
