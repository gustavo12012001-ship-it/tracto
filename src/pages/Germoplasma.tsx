import { useState, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
type GenoStatus = 'Em desenvolvimento' | 'Candidata' | 'Descartada' | 'Registrada';

interface Genotype {
  id: string;
  name: string;
  species: string;
  generation: string;
  status: GenoStatus;
  origin: string;
  female_parent: string;
  male_parent: string;
  year_obtained: string;
  notes: string;
  traits: string;
  createdAt: string;
}

interface Cross {
  id: string;
  date: string;
  female_parent: string;
  male_parent: string;
  f1_name: string;
  purpose: string;
  location: string;
  f1_count: number;
  notes: string;
  createdAt: string;
}

interface Generation {
  id: string;
  genotype_id: string;
  generation_label: string;
  year: string;
  location: string;
  plants_evaluated: number;
  plants_selected: number;
  selection_criteria: string;
  mean_yield: number | null;
  notes: string;
  createdAt: string;
}

type GermoTab = 'germoplasma' | 'cruzamentos' | 'geracoes';

// ── localStorage helpers ───────────────────────────────────────────────────────
const G_KEY = 'tracto-germoplasma-v1';
const C_KEY = 'tracto-crosses-v1';
const GEN_KEY = 'tracto-generations-v1';

const loadGenotypes  = (): Genotype[]   => { try { return JSON.parse(localStorage.getItem(G_KEY)   ?? '[]'); } catch { return []; } };
const saveGenotypes  = (d: Genotype[])  => { try { localStorage.setItem(G_KEY,   JSON.stringify(d)); } catch { /**/ } };
const loadCrosses    = (): Cross[]      => { try { return JSON.parse(localStorage.getItem(C_KEY)   ?? '[]'); } catch { return []; } };
const saveCrosses    = (d: Cross[])     => { try { localStorage.setItem(C_KEY,   JSON.stringify(d)); } catch { /**/ } };
const loadGenerations = (): Generation[] => { try { return JSON.parse(localStorage.getItem(GEN_KEY) ?? '[]'); } catch { return []; } };
const saveGenerations = (d: Generation[]) => { try { localStorage.setItem(GEN_KEY, JSON.stringify(d)); } catch { /**/ } };

// ── Style helpers ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<GenoStatus, { bg: string; color: string }> = {
  'Registrada':       { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80' },
  'Candidata':        { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa' },
  'Em desenvolvimento': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Descartada':       { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
};

const GEN_ORDER = ['F1','F2','F3','F4','F5','F6','F7','F8','BC1','BC2','BC3','S1','S2','S3','S4','S5','Linhagem Pura','Avançada'];

const inpCls = 'w-full px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none focus:border-[var(--primary)] transition-colors';
const inpStyle = { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' };
const lblCls = 'text-[10px] font-bold uppercase tracking-widest mb-1 block';

// ── Germoplasma Tab ────────────────────────────────────────────────────────────
function GermoplasmaTab() {
  const [list, setList]     = useState<Genotype[]>(loadGenotypes);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<GenoStatus | 'Todos'>('Todos');

  const emptyForm = { name:'', species:'', generation:'F1', status:'Em desenvolvimento' as GenoStatus,
    origin:'', female_parent:'', male_parent:'', year_obtained: String(new Date().getFullYear()),
    notes:'', traits:'' };
  const [form, setForm] = useState(emptyForm);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    if (!form.name.trim()) return;
    const updated = [...list, { ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() }];
    setList(updated); saveGenotypes(updated); setForm(emptyForm); setShowForm(false);
  };

  const del = (id: string) => {
    if (!window.confirm('Excluir esta linhagem?')) return;
    const updated = list.filter(g => g.id !== id);
    setList(updated); saveGenotypes(updated);
  };

  const filtered = useMemo(() => list.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !q || g.name.toLowerCase().includes(q) || g.species.toLowerCase().includes(q) || g.traits.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'Todos' || g.status === filterStatus;
    return matchSearch && matchStatus;
  }), [list, search, filterStatus]);

  const counts = useMemo(() => ({
    total: list.length,
    dev: list.filter(g => g.status === 'Em desenvolvimento').length,
    cand: list.filter(g => g.status === 'Candidata').length,
    reg: list.filter(g => g.status === 'Registrada').length,
  }), [list]);

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de linhagens',    value: counts.total, color: '#94a3b8' },
          { label: 'Em desenvolvimento',    value: counts.dev,   color: '#f59e0b' },
          { label: 'Candidatas a registro', value: counts.cand,  color: '#60a5fa' },
          { label: 'Registradas',           value: counts.reg,   color: '#4ade80' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[10px] mt-1 leading-tight" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-sm text-white bg-transparent border focus:outline-none focus:border-[var(--primary)]"
          style={inpStyle} placeholder="Buscar linhagem, espécie, característica..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as GenoStatus | 'Todos')}
          className="px-3 py-2 rounded-xl text-sm text-white border"
          style={{ ...inpStyle, background: '#1e293b' }}>
          <option value="Todos">Todos os status</option>
          {(['Em desenvolvimento','Candidata','Registrada','Descartada'] as GenoStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: showForm ? 'rgba(255,255,255,0.08)' : 'var(--primary)' }}>
          <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Nova Linhagem'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.09)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Nova Linhagem</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={lblCls} style={{ color: '#60a5fa' }}>Nome / Código *</label>
              <input className={inpCls} style={inpStyle} value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ex: TMG-803-F3-12" /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Espécie</label>
              <input className={inpCls} style={inpStyle} value={form.species} onChange={e => f('species', e.target.value)} placeholder="Ex: Glycine max (Soja)" /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Geração</label>
              <select className={inpCls} style={{ ...inpStyle, background: '#1e293b' }} value={form.generation} onChange={e => f('generation', e.target.value)}>
                {GEN_ORDER.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Status</label>
              <select className={inpCls} style={{ ...inpStyle, background: '#1e293b' }} value={form.status} onChange={e => f('status', e.target.value as GenoStatus)}>
                {(['Em desenvolvimento','Candidata','Registrada','Descartada'] as GenoStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className={lblCls} style={{ color: '#f472b6' }}>♀ Parental feminino</label>
              <input className={inpCls} style={inpStyle} value={form.female_parent} onChange={e => f('female_parent', e.target.value)} placeholder="Nome da linhagem ♀" /></div>
            <div><label className={lblCls} style={{ color: '#818cf8' }}>♂ Parental masculino</label>
              <input className={inpCls} style={inpStyle} value={form.male_parent} onChange={e => f('male_parent', e.target.value)} placeholder="Nome da linhagem ♂" /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Ano de obtenção</label>
              <input className={inpCls} style={inpStyle} value={form.year_obtained} onChange={e => f('year_obtained', e.target.value)} placeholder="2024" /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Origem / Instituição</label>
              <input className={inpCls} style={inpStyle} value={form.origin} onChange={e => f('origin', e.target.value)} placeholder="Ex: EMBRAPA, IAC..." /></div>
            <div><label className={lblCls} style={{ color: '#34d399' }}>Características-chave</label>
              <input className={inpCls} style={inpStyle} value={form.traits} onChange={e => f('traits', e.target.value)} placeholder="resistência, produtividade, ciclo..." /></div>
          </div>
          <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Observações</label>
            <textarea className={inpCls + ' resize-none'} style={{ ...inpStyle, minHeight: 56 }} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Notas gerais sobre esta linhagem..." /></div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!form.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <span className="material-symbols-outlined text-sm">save</span>Salvar Linhagem
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/5" style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: '#1e293b' }}>genetics</span>
          <p className="text-sm font-bold text-white">Banco de germoplasma vazio</p>
          <p className="text-xs text-center px-8" style={{ color: 'var(--muted)' }}>Cadastre as linhagens do seu programa de melhoramento.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(g => {
            const sc = STATUS_COLORS[g.status];
            return (
              <div key={g.id} className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>{g.generation}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>{g.status}</span>
                    </div>
                    <p className="text-sm font-black text-white">{g.name}</p>
                    {g.species && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{g.species}</p>}
                  </div>
                  <button onClick={() => del(g.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" style={{ color: '#f87171', flexShrink: 0 }}>
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
                {(g.female_parent || g.male_parent) && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#f472b6' }}>♀ {g.female_parent || '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>×</span>
                    <span style={{ color: '#818cf8' }}>♂ {g.male_parent || '—'}</span>
                  </div>
                )}
                {g.traits && (
                  <div className="flex gap-1 flex-wrap">
                    {g.traits.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>{t}</span>
                    ))}
                  </div>
                )}
                {g.notes && <p className="text-xs italic" style={{ color: 'var(--muted)' }}>{g.notes}</p>}
                <div className="flex items-center gap-3 text-[10px]" style={{ color: '#334155' }}>
                  {g.year_obtained && <span>📅 {g.year_obtained}</span>}
                  {g.origin && <span>🏛️ {g.origin}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Cruzamentos Tab ────────────────────────────────────────────────────────────
function CruzamentosTab() {
  const [list, setList]     = useState<Cross[]>(loadCrosses);
  const [showForm, setShowForm] = useState(false);

  const empty = { date: '', female_parent: '', male_parent: '', f1_name: '', purpose: '', location: '', f1_count: 0, notes: '' };
  const [form, setForm] = useState(empty);
  const f = (k: string, v: string | number) => {
    const updated = { ...form, [k]: v };
    // Auto-suggest F1 name
    if (k === 'female_parent' || k === 'male_parent') {
      const fp = k === 'female_parent' ? String(v) : form.female_parent;
      const mp = k === 'male_parent'   ? String(v) : form.male_parent;
      if (fp && mp && !form.f1_name) updated.f1_name = `${fp} × ${mp}`;
    }
    setForm(updated);
  };

  const save = () => {
    if (!form.female_parent.trim() || !form.male_parent.trim()) return;
    const updated = [{ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...list];
    setList(updated); saveCrosses(updated); setForm(empty); setShowForm(false);
  };

  const del = (id: string) => {
    const updated = list.filter(c => c.id !== id);
    setList(updated); saveCrosses(updated);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">Registro de Cruzamentos</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{list.length} cruzamento{list.length !== 1 ? 's' : ''} registrado{list.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90"
          style={{ background: showForm ? 'rgba(255,255,255,0.08)' : 'var(--primary)' }}>
          <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Novo Cruzamento'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.09)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Registrar Cruzamento</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Data *</label>
              <input type="date" className={inpCls} style={inpStyle} value={form.date} onChange={e => f('date', e.target.value)} /></div>
            <div><label className={lblCls} style={{ color: '#f472b6' }}>♀ Parental feminino *</label>
              <input className={inpCls} style={inpStyle} value={form.female_parent} onChange={e => f('female_parent', e.target.value)} placeholder="Nome da mãe" /></div>
            <div><label className={lblCls} style={{ color: '#818cf8' }}>♂ Parental masculino *</label>
              <input className={inpCls} style={inpStyle} value={form.male_parent} onChange={e => f('male_parent', e.target.value)} placeholder="Nome do pai" /></div>
            <div><label className={lblCls} style={{ color: '#60a5fa' }}>Nome do F1 gerado</label>
              <input className={inpCls} style={inpStyle} value={form.f1_name} onChange={e => f('f1_name', e.target.value)} placeholder="Auto-gerado" /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Local do cruzamento</label>
              <input className={inpCls} style={inpStyle} value={form.location} onChange={e => f('location', e.target.value)} placeholder="Ex: Estação experimental" /></div>
            <div><label className={lblCls} style={{ color: '#4ade80' }}>Sementes F1 obtidas</label>
              <input type="number" min={0} className={inpCls} style={inpStyle} value={form.f1_count || ''} onChange={e => f('f1_count', parseInt(e.target.value) || 0)} placeholder="0" /></div>
          </div>
          <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Objetivo do cruzamento</label>
            <input className={inpCls} style={inpStyle} value={form.purpose} onChange={e => f('purpose', e.target.value)} placeholder="Ex: Combinar resistência a ferrugem com alta produtividade" /></div>
          <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Notas</label>
            <textarea className={inpCls + ' resize-none'} style={{ ...inpStyle, minHeight: 48 }} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!form.female_parent.trim() || !form.male_parent.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <span className="material-symbols-outlined text-sm">join_inner</span>Registrar Cruzamento
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: '#1e293b' }}>join_inner</span>
          <p className="text-sm font-bold text-white">Nenhum cruzamento registrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(c => (
            <div key={c.id} className="rounded-2xl border p-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-black" style={{ color: '#f472b6' }}>♀ {c.female_parent}</span>
                    <span className="text-base font-black" style={{ color: 'var(--muted)' }}>×</span>
                    <span className="text-sm font-black" style={{ color: '#818cf8' }}>♂ {c.male_parent}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                      F1: {c.f1_name || '—'}
                    </span>
                  </div>
                  {c.purpose && <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>{c.purpose}</p>}
                  <div className="flex items-center gap-4 mt-1.5 text-[10px]" style={{ color: '#475569' }}>
                    {c.date && <span>📅 {c.date.split('-').reverse().join('/')}</span>}
                    {c.location && <span>📍 {c.location}</span>}
                    {c.f1_count > 0 && <span>🌱 {c.f1_count} sementes F1</span>}
                  </div>
                  {c.notes && <p className="text-[11px] mt-1 italic" style={{ color: '#475569' }}>{c.notes}</p>}
                </div>
                <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 flex-shrink-0" style={{ color: '#f87171' }}>
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gerações Tab ───────────────────────────────────────────────────────────────
function GeracoesTab() {
  const genotypes        = useState<Genotype[]>(loadGenotypes)[0];
  const [allGens, setAllGens] = useState<Generation[]>(loadGenerations);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  const empty = { genotype_id: selectedId, generation_label: 'F2', year: String(new Date().getFullYear()),
    location: '', plants_evaluated: 0, plants_selected: 0, selection_criteria: '', mean_yield: null as null | number, notes: '' };
  const [form, setForm] = useState(empty);
  const f = (k: string, v: string | number | null) => setForm(p => ({ ...p, [k]: v }));

  const myGens = useMemo(() => allGens.filter(g => g.genotype_id === selectedId).sort((a,b) => a.generation_label.localeCompare(b.generation_label)), [allGens, selectedId]);

  const save = () => {
    if (!selectedId || !form.generation_label) return;
    const updated = [...allGens, { ...form, genotype_id: selectedId, id: crypto.randomUUID(), createdAt: new Date().toISOString() }];
    setAllGens(updated); saveGenerations(updated); setForm({ ...empty, genotype_id: selectedId }); setShowForm(false);
  };

  const del = (id: string) => {
    const updated = allGens.filter(g => g.id !== id);
    setAllGens(updated); saveGenerations(updated);
  };

  const selected = genotypes.find(g => g.id === selectedId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className={lblCls} style={{ color: 'var(--primary)' }}>Selecione a linhagem</label>
        <select className={inpCls} style={{ ...inpStyle, background: '#1e293b', maxWidth: 400 }}
          value={selectedId} onChange={e => { setSelectedId(e.target.value); setShowForm(false); }}>
          <option value="">— Selecione uma linhagem —</option>
          {genotypes.map(g => <option key={g.id} value={g.id}>{g.name} ({g.generation}) — {g.status}</option>)}
        </select>
      </div>

      {selected && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-white">{selected.name}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{selected.species} · Atual: {selected.generation} · {myGens.length} registro{myGens.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90"
            style={{ background: showForm ? 'rgba(255,255,255,0.08)' : 'var(--primary)' }}>
            <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancelar' : 'Registrar Geração'}
          </button>
        </div>
      )}

      {showForm && selected && (
        <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.09)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Registrar Geração — {selected.name}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={lblCls} style={{ color: '#60a5fa' }}>Geração *</label>
              <select className={inpCls} style={{ ...inpStyle, background: '#1e293b' }} value={form.generation_label} onChange={e => f('generation_label', e.target.value)}>
                {GEN_ORDER.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Ano / Safra</label>
              <input className={inpCls} style={inpStyle} value={form.year} onChange={e => f('year', e.target.value)} /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Local do ensaio</label>
              <input className={inpCls} style={inpStyle} value={form.location} onChange={e => f('location', e.target.value)} placeholder="Município, UF" /></div>
            <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Plantas avaliadas</label>
              <input type="number" min={0} className={inpCls} style={inpStyle} value={form.plants_evaluated || ''} onChange={e => f('plants_evaluated', parseInt(e.target.value) || 0)} /></div>
            <div><label className={lblCls} style={{ color: '#4ade80' }}>Plantas selecionadas</label>
              <input type="number" min={0} className={inpCls} style={inpStyle} value={form.plants_selected || ''} onChange={e => f('plants_selected', parseInt(e.target.value) || 0)} /></div>
            <div><label className={lblCls} style={{ color: '#f59e0b' }}>Produtividade média (sc/ha)</label>
              <input type="number" min={0} step={0.1} className={inpCls} style={inpStyle} value={form.mean_yield ?? ''} onChange={e => f('mean_yield', parseFloat(e.target.value) || null)} /></div>
          </div>
          <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Critérios de seleção</label>
            <input className={inpCls} style={inpStyle} value={form.selection_criteria} onChange={e => f('selection_criteria', e.target.value)} placeholder="Ex: produtividade > 60 sc/ha + resistência a doenças" /></div>
          <div><label className={lblCls} style={{ color: 'var(--muted)' }}>Notas</label>
            <textarea className={inpCls + ' resize-none'} style={{ ...inpStyle, minHeight: 48 }} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
          <button onClick={save} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: 'var(--primary)' }}>
            <span className="material-symbols-outlined text-sm">save</span>Salvar Geração
          </button>
        </div>
      )}

      {selectedId && myGens.length === 0 && !showForm && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Nenhuma geração registrada para esta linhagem.</p>
      )}

      {myGens.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: 'var(--muted)' }}>Histórico de gerações</p>
          {myGens.map((gen, idx) => (
            <div key={gen.id} className="flex items-start gap-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* timeline dot */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 2 }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>{idx + 1}</div>
                {idx < myGens.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,0.06)', minHeight: 16 }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-black" style={{ color: '#60a5fa' }}>{gen.generation_label}</span>
                  {gen.year && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>{gen.year}</span>}
                  {gen.location && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>📍 {gen.location}</span>}
                </div>
                <div className="flex gap-4 text-xs flex-wrap">
                  {gen.plants_evaluated > 0 && <span style={{ color: '#94a3b8' }}>Avaliadas: <strong className="text-white">{gen.plants_evaluated}</strong></span>}
                  {gen.plants_selected > 0 && <span style={{ color: '#4ade80' }}>Selecionadas: <strong className="text-white">{gen.plants_selected}</strong></span>}
                  {gen.mean_yield !== null && gen.mean_yield !== undefined && (
                    <span style={{ color: '#f59e0b' }}>Produtividade: <strong className="text-white">{gen.mean_yield.toFixed(1)} sc/ha</strong></span>
                  )}
                </div>
                {gen.selection_criteria && <p className="text-xs mt-1 italic" style={{ color: '#64748b' }}>Critério: {gen.selection_criteria}</p>}
                {gen.notes && <p className="text-xs mt-0.5 italic" style={{ color: '#475569' }}>{gen.notes}</p>}
              </div>
              <button onClick={() => del(gen.id)} className="p-1 rounded hover:bg-red-500/10 flex-shrink-0" style={{ color: '#f87171' }}>
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {!selectedId && (
        <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="material-symbols-outlined text-4xl" style={{ color: '#1e293b' }}>family_history</span>
          <p className="text-sm font-bold text-white">Selecione uma linhagem acima</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>para ver e registrar o histórico de gerações</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Germoplasma() {
  const [tab, setTab] = useState<GermoTab>('germoplasma');

  const TABS: { id: GermoTab; label: string; icon: string }[] = [
    { id: 'germoplasma',  label: 'Banco de Germoplasma', icon: 'genetics'       },
    { id: 'cruzamentos',  label: 'Cruzamentos',           icon: 'join_inner'     },
    { id: 'geracoes',     label: 'Gerações',              icon: 'family_history' },
  ];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>genetics</span>
            <h1 className="text-2xl font-black text-white">Banco de Germoplasma</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Gestão de linhagens, cruzamentos e histórico de gerações do programa de melhoramento.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={tab === t.id
                ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }}>
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'germoplasma' && <GermoplasmaTab />}
        {tab === 'cruzamentos' && <CruzamentosTab />}
        {tab === 'geracoes'    && <GeracoesTab />}

      </div>
    </div>
  );
}
