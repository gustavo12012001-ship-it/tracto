import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { apiFetch } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, CartesianGrid,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Season {
  id: string;
  field_id: string;
  user_id?: string;
  name: string;
  crop_type?: string;
  planting_date?: string;
  harvest_date?: string;
  area_ha?: number;
  productivity_sc_ha?: number;
  productivity_kg_ha?: number;
  notes?: string;
  created_at?: string;
}

type SeasonStatus = 'planejada' | 'em_andamento' | 'colhida';

function getSeasonStatus(s: Season): SeasonStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (!s.planting_date || s.planting_date > today) return 'planejada';
  if (s.harvest_date && s.harvest_date <= today) return 'colhida';
  return 'em_andamento';
}

const STATUS_LABEL: Record<SeasonStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  colhida: 'Colhida',
};
const STATUS_COLOR: Record<SeasonStatus, string> = {
  planejada: '#64748b',
  em_andamento: '#f59e0b',
  colhida: '#22c55e',
};

function fmtDate(d?: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{label}</p>
      <p style={{ color: '#22c55e', fontSize: 13 }}>{payload[0].value.toFixed(1)} sc/ha</p>
    </div>
  );
}

// ── Formulário ────────────────────────────────────────────────────────────────
interface SeasonFormData {
  name: string;
  crop_type: string;
  planting_date: string;
  harvest_date: string;
  area_ha: string;
  productivity_sc_ha: string;
  notes: string;
}

const EMPTY_FORM: SeasonFormData = {
  name: '', crop_type: '', planting_date: '', harvest_date: '',
  area_ha: '', productivity_sc_ha: '', notes: '',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Seasons() {
  const { farms, activeFieldId, setActiveField } = useAppStore();
  const allFields = useMemo(() => farms.flatMap(f => f.fields.map(field => ({ ...field, farmName: f.name }))), [farms]);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SeasonFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'lista' | 'rotacao'>('lista');

  const activeField = allFields.find(f => f.id === activeFieldId);

  // Carrega safras quando muda o talhão
  useEffect(() => {
    if (!activeFieldId) { setSeasons([]); return; }
    setLoading(true);
    setError(null);
    apiFetch<Season[]>(`/api/fields/${activeFieldId}/seasons`)
      .then(setSeasons)
      .catch(() => setError('Não foi possível carregar as safras.'))
      .finally(() => setLoading(false));
  }, [activeFieldId]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, area_ha: String(activeField?.areaHa ?? '') });
    setShowForm(true);
  }

  function openEdit(s: Season) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      crop_type: s.crop_type ?? '',
      planting_date: s.planting_date ?? '',
      harvest_date: s.harvest_date ?? '',
      area_ha: s.area_ha != null ? String(s.area_ha) : '',
      productivity_sc_ha: s.productivity_sc_ha != null ? String(s.productivity_sc_ha) : '',
      notes: s.notes ?? '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!activeFieldId || !form.name.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      crop_type: form.crop_type || undefined,
      planting_date: form.planting_date || undefined,
      harvest_date: form.harvest_date || undefined,
      area_ha: form.area_ha ? Number(form.area_ha) : undefined,
      productivity_sc_ha: form.productivity_sc_ha ? Number(form.productivity_sc_ha) : undefined,
      productivity_kg_ha: form.productivity_sc_ha ? Number(form.productivity_sc_ha) * 60 : undefined,
      notes: form.notes || undefined,
    };
    try {
      if (editingId) {
        const updated = await apiFetch<Season>(`/api/fields/${activeFieldId}/seasons/${editingId}`, {
          method: 'PATCH', body: JSON.stringify(body),
        });
        setSeasons(prev => prev.map(s => s.id === editingId ? updated : s));
      } else {
        const created = await apiFetch<Season>(`/api/fields/${activeFieldId}/seasons`, {
          method: 'POST', body: JSON.stringify(body),
        });
        setSeasons(prev => [created, ...prev]);
      }
      setShowForm(false);
    } catch {
      alert('Erro ao salvar safra. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!activeFieldId || !confirm('Remover esta safra?')) return;
    await apiFetch(`/api/fields/${activeFieldId}/seasons/${id}`, { method: 'DELETE' }).catch(() => null);
    setSeasons(prev => prev.filter(s => s.id !== id));
  }

  // Dados do gráfico
  const chartData = seasons
    .filter(s => s.productivity_sc_ha != null)
    .map(s => ({ name: s.name, value: s.productivity_sc_ha as number }))
    .reverse();
  const avgProd = chartData.length > 0 ? chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length : 0;
  const maxProd = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 0;

  // Totais
  const totalSacas = seasons.reduce((sum, s) => {
    if (s.productivity_sc_ha != null && s.area_ha != null) return sum + s.productivity_sc_ha * s.area_ha;
    return sum;
  }, 0);

  return (
    <section className="flex-1 flex flex-col overflow-hidden p-4 gap-4 min-w-0" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--primary)' }}>grass</span>
          <div>
            <h1 className="text-2xl font-black text-white">Safras & Produtividade</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Histórico de safras por talhão</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle lista / rotação */}
          {seasons.length > 0 && (
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              {(['lista', 'rotacao'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
                  style={view === v
                    ? { background: 'var(--primary)', color: '#fff' }
                    : { background: 'var(--surface)', color: 'var(--muted)' }}>
                  <span className="material-symbols-outlined text-sm">
                    {v === 'lista' ? 'list' : 'timeline'}
                  </span>
                  {v === 'lista' ? 'Lista' : 'Rotação'}
                </button>
              ))}
            </div>
          )}
          {activeFieldId && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white"
              style={{ background: 'var(--primary)' }}>
              <span className="material-symbols-outlined text-base">add</span>
              Nova Safra
            </button>
          )}
        </div>
      </div>

      {/* Seletor de talhão */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          Talhão
        </label>
        <select
          value={activeFieldId ?? ''}
          onChange={e => setActiveField(e.target.value || null)}
          className="w-full rounded-xl px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <option value="">Selecione um talhão...</option>
          {farms.map(farm => (
            <optgroup key={farm.id} label={farm.name}>
              {farm.fields.map(f => (
                <option key={f.id} value={f.id}>{f.name}{f.areaHa ? ` (${f.areaHa} ha)` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {!activeFieldId && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
          <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>grass</span>
          <p style={{ color: 'var(--muted)' }}>Selecione um talhão para ver as safras</p>
        </div>
      )}

      {activeFieldId && (
        <>
          {/* Formulário */}
          {showForm && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="font-bold text-white">{editingId ? 'Editar Safra' : 'Nova Safra'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Nome da safra *', key: 'name', placeholder: 'Soja 2025/26', type: 'text' },
                  { label: 'Cultura', key: 'crop_type', placeholder: 'Soja, Milho, Algodão...', type: 'text' },
                  { label: 'Data de plantio', key: 'planting_date', placeholder: '', type: 'date' },
                  { label: 'Data de colheita', key: 'harvest_date', placeholder: '', type: 'date' },
                  { label: 'Área (ha)', key: 'area_ha', placeholder: '0.0', type: 'number' },
                  { label: 'Produtividade realizada (sc/ha)', key: 'productivity_sc_ha', placeholder: '0.0', type: 'number' },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
                    <input
                      type={type}
                      value={form[key as keyof SeasonFormData]}
                      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                ))}
              </div>
              {/* Preview de sacas totais */}
              {form.productivity_sc_ha && form.area_ha && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: '#22c55e' }}>inventory</span>
                  <span style={{ color: '#22c55e' }}>
                    Total estimado: <strong>{(Number(form.productivity_sc_ha) * Number(form.area_ha)).toFixed(0)} sacas</strong>
                    {' '}({(Number(form.productivity_sc_ha) * 60).toFixed(0)} kg/ha)
                  </span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>Observações</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2} placeholder="Variedade, observações de campo..."
                  className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex-1 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-40"
                  style={{ background: 'var(--primary)' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Loading / Error */}
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--muted)' }}>
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              Carregando safras...
            </div>
          )}
          {error && <div className="text-sm text-red-400 px-4">{error}</div>}

          {/* Gráfico de produtividade */}
          {chartData.length >= 2 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="font-bold text-white mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>bar_chart</span>
                Evolução da Produtividade
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Média histórica: <strong style={{ color: '#f59e0b' }}>{avgProd.toFixed(1)} sc/ha</strong>
                {' '}— Melhor safra: <strong style={{ color: '#22c55e' }}>{maxProd.toFixed(1)} sc/ha</strong>
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={avgProd} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Média', fill: '#f59e0b', fontSize: 10 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.value === maxProd ? '#22c55e' : 'var(--primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Resumo */}
          {seasons.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Safras', value: String(seasons.length), icon: 'grass' },
                { label: 'Colhidas', value: String(seasons.filter(s => getSeasonStatus(s) === 'colhida').length), icon: 'done_all' },
                { label: 'Média sc/ha', value: avgProd > 0 ? avgProd.toFixed(1) : '—', icon: 'trending_up' },
                { label: 'Total sacas', value: totalSacas > 0 ? totalSacas.toFixed(0) : '—', icon: 'inventory' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>{icon}</span>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
                    <p className="text-lg font-black text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Rotação de Culturas ── */}
          {view === 'rotacao' && seasons.length > 0 && (() => {
            const CROP_COLORS: Record<string, string> = {
              soja: '#4ade80', milho: '#fbbf24', trigo: '#d4a574',
              algodao: '#e2e8f0', sorgo: '#f97316', feijao: '#a78bfa',
              cana: '#34d399', arroz: '#60a5fa',
            };
            const cropColor = (ct?: string) => {
              if (!ct) return '#ec5b13';
              const k = ct.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0].replace(/[^a-z]/g, '');
              return CROP_COLORS[k] ?? '#ec5b13';
            };
            // Agrupar por ano (do plantio)
            const byYear = new Map<number, Season[]>();
            seasons.forEach(s => {
              const yr = s.planting_date ? new Date(s.planting_date).getFullYear() : new Date().getFullYear();
              if (!byYear.has(yr)) byYear.set(yr, []);
              byYear.get(yr)!.push(s);
            });
            const years = Array.from(byYear.keys()).sort((a, b) => b - a);
            return (
              <div className="rounded-2xl p-4 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>timeline</span>
                  <h3 className="font-bold text-white text-sm">Rotação de Culturas</h3>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--muted)' }}>{seasons.length} safra{seasons.length !== 1 ? 's' : ''} registrada{seasons.length !== 1 ? 's' : ''}</span>
                </div>
                {years.map(yr => {
                  const yrSeasons = byYear.get(yr)!;
                  // Janela: 01/Set ano-1 a 31/Ago ano (safra brasileira)
                  const winStart = new Date(`${yr - 1}-09-01`).getTime();
                  const winEnd = new Date(`${yr}-08-31`).getTime();
                  const winRange = winEnd - winStart;
                  return (
                    <div key={yr}>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>Safra {yr - 1}/{String(yr).slice(-2)}</p>
                      <div className="relative h-10 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                        {yrSeasons.map(s => {
                          if (!s.planting_date) return null;
                          const start = Math.max(new Date(s.planting_date).getTime(), winStart);
                          const end = s.harvest_date ? Math.min(new Date(s.harvest_date).getTime(), winEnd) : Math.min(Date.now(), winEnd);
                          const left = ((start - winStart) / winRange) * 100;
                          const width = Math.max(2, ((end - start) / winRange) * 100);
                          const color = cropColor(s.crop_type);
                          const status = getSeasonStatus(s);
                          return (
                            <div key={s.id}
                              className="absolute top-1 bottom-1 rounded-lg flex items-center px-2 overflow-hidden"
                              style={{ left: `${left}%`, width: `${width}%`, background: color + '30', border: `1.5px solid ${color}`, minWidth: 4 }}
                              title={`${s.name} · ${fmtDate(s.planting_date)} → ${fmtDate(s.harvest_date)}`}>
                              <span className="text-[10px] font-bold truncate" style={{ color }}>
                                {s.crop_type ?? s.name}
                                {status === 'em_andamento' && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                              </span>
                            </div>
                          );
                        })}
                        {/* Linha de hoje */}
                        {(() => {
                          const todayPct = ((Date.now() - winStart) / winRange) * 100;
                          if (todayPct < 0 || todayPct > 100) return null;
                          return <div className="absolute top-0 bottom-0 w-px" style={{ left: `${todayPct}%`, background: 'rgba(236,91,19,0.7)' }} />;
                        })()}
                      </div>
                      {/* Meses */}
                      <div className="flex justify-between mt-1">
                        {['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'].map((m, i) => (
                          <span key={i} className="text-[8px]" style={{ color: '#334155' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Legenda */}
                <div className="flex flex-wrap gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  {Array.from(new Set(seasons.map(s => s.crop_type).filter(Boolean))).map(ct => (
                    <div key={ct} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded" style={{ background: cropColor(ct) }} />
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{ct}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <div className="w-px h-3" style={{ background: 'rgba(236,91,19,0.7)' }} />
                    <span className="text-[10px]" style={{ color: '#ec5b13' }}>Hoje</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Lista de safras */}
          {!loading && seasons.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 opacity-50">
              <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--muted)' }}>agriculture</span>
              <p style={{ color: 'var(--muted)' }}>Nenhuma safra cadastrada para este talhão</p>
              <button onClick={openCreate}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--primary)' }}>
                + Cadastrar primeira safra
              </button>
            </div>
          )}

          <div className={`flex flex-col gap-3 ${view === 'rotacao' ? 'hidden' : ''}`}>
            {seasons.map(s => {
              const status = getSeasonStatus(s);
              const totalSacasS = s.productivity_sc_ha != null && s.area_ha != null
                ? (s.productivity_sc_ha * s.area_ha).toFixed(0)
                : null;
              return (
                <div key={s.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--primary)' }}>grass</span>
                      <div>
                        <h4 className="font-bold text-white text-base">{s.name}</h4>
                        {s.crop_type && <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.crop_type}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}>
                        {STATUS_LABEL[status]}
                      </span>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--muted)' }}>
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: '#f87171' }}>
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    {[
                      { label: 'Plantio', value: fmtDate(s.planting_date) },
                      { label: 'Colheita', value: fmtDate(s.harvest_date) },
                      { label: 'Área', value: s.area_ha != null ? `${s.area_ha} ha` : '—' },
                      { label: 'Produtividade', value: s.productivity_sc_ha != null ? `${s.productivity_sc_ha} sc/ha` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl p-2" style={{ background: 'var(--bg)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{label}</p>
                        <p className="text-sm font-bold text-white mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  {totalSacasS && (
                    <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
                      style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <span className="material-symbols-outlined text-base" style={{ color: '#22c55e' }}>inventory</span>
                      <span className="text-sm font-bold" style={{ color: '#22c55e' }}>{totalSacasS} sacas totais</span>
                      {s.productivity_sc_ha && <span className="text-xs" style={{ color: 'var(--muted)' }}>({(s.productivity_sc_ha * 60).toFixed(0)} kg/ha)</span>}
                    </div>
                  )}
                  {s.notes && <p className="text-xs mt-2 italic" style={{ color: 'var(--muted)' }}>{s.notes}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
