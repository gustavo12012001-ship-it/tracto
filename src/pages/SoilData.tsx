import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SoilAnalysis {
  fieldId: string;
  fieldName: string;
  importedAt: string;
  ph?: number;
  mo?: number;        // M.O. (%)
  p?: number;         // P (mg/dm³)
  k?: number;         // K (mg/dm³)
  ca?: number;        // Ca (cmolc/dm³)
  mg?: number;        // Mg (cmolc/dm³)
  al?: number;        // Al (cmolc/dm³)
  ctc?: number;       // CTC (cmolc/dm³)
  v?: number;         // V (%)
  b?: number;         // B (mg/dm³)
  cu?: number;        // Cu (mg/dm³)
  fe?: number;        // Fe (mg/dm³)
  mn?: number;        // Mn (mg/dm³)
  zn?: number;        // Zn (mg/dm³)
}

const SOIL_KEY = 'tracto-soil-v1';

function loadAllSoil(): Record<string, SoilAnalysis> {
  try { return JSON.parse(localStorage.getItem(SOIL_KEY) ?? '{}'); } catch { return {}; }
}

function saveSoil(fieldId: string, analysis: SoilAnalysis) {
  const all = loadAllSoil();
  all[fieldId] = analysis;
  try { localStorage.setItem(SOIL_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

function deleteSoil(fieldId: string) {
  const all = loadAllSoil();
  delete all[fieldId];
  try { localStorage.setItem(SOIL_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

// ── CSV Parser ─────────────────────────────────────────────────────────────────
const CSV_COLUMN_MAP: Record<string, keyof SoilAnalysis> = {
  'ph': 'ph',
  'mo': 'mo', 'm.o': 'mo', 'm.o.': 'mo', 'materia organica': 'mo', 'matéria orgânica': 'mo',
  'p': 'p',
  'k': 'k',
  'ca': 'ca',
  'mg': 'mg',
  'al': 'al',
  'ctc': 'ctc',
  'v': 'v', 'v%': 'v',
  'b': 'b',
  'cu': 'cu',
  'fe': 'fe',
  'mn': 'mn',
  'zn': 'zn',
};

function parseCSV(text: string): Partial<SoilAnalysis> | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const headers = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase().replace(/[()]/g, '').trim());
  const values = lines[1].split(/[;,\t]/).map(v => v.trim().replace(',', '.'));

  const result: Partial<SoilAnalysis> = {};
  headers.forEach((header, idx) => {
    const key = CSV_COLUMN_MAP[header];
    if (key && values[idx] !== undefined) {
      const num = parseFloat(values[idx]);
      if (!isNaN(num)) {
        (result as Record<string, number>)[key as string] = num;
      }
    }
  });

  return Object.keys(result).length > 0 ? result : null;
}

// ── Interpretation helpers ─────────────────────────────────────────────────────
interface InterpRange {
  label: string;
  color: string;
  bg: string;
  min?: number;
  max?: number;
}

function interpretPH(v: number): InterpRange {
  if (v < 5.5) return { label: 'Ácido', color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
  if (v <= 6.5) return { label: 'Ideal', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' };
  return { label: 'Alcalino', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
}

function interpretV(v: number): InterpRange {
  if (v < 50) return { label: 'Baixo', color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
  if (v <= 70) return { label: 'Médio', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
  return { label: 'Bom', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' };
}

function interpretMO(v: number): InterpRange {
  if (v < 20) return { label: 'Baixo', color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
  if (v <= 40) return { label: 'Médio', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
  return { label: 'Alto', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' };
}

function interpretGeneric(v: number, low: number, high: number): InterpRange {
  if (v < low) return { label: 'Baixo', color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
  if (v <= high) return { label: 'Adequado', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' };
  return { label: 'Alto', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
}

function getOverallBadge(a: SoilAnalysis): { label: string; color: string; bg: string; icon: string } {
  const issues: number[] = [];
  if (a.ph !== undefined && a.ph < 5.5) issues.push(1);
  if (a.v !== undefined && a.v < 50) issues.push(1);
  if (a.mo !== undefined && a.mo < 20) issues.push(1);
  if (a.al !== undefined && a.al > 0.5) issues.push(1);

  if (issues.length === 0) return { label: 'Solo equilibrado', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: 'check_circle' };
  if (a.ph !== undefined && a.ph < 5.5) return { label: 'Solo ácido', color: '#f87171', bg: 'rgba(239,68,68,0.10)', icon: 'warning' };
  return { label: 'Correção necessária', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', icon: 'info' };
}

// ── Gauge component ─────────────────────────────────────────────────────────────
function Gauge({ label, value, unit, min, max, interpret }: {
  label: string;
  value: number | undefined;
  unit: string;
  min: number;
  max: number;
  interpret: (v: number) => InterpRange;
}) {
  if (value === undefined) return null;
  const interp = interpret(value);
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white">{label}</p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: interp.bg, color: interp.color }}>
          {interp.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-lg font-black text-white leading-none">{value.toFixed(1)}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{unit}</p>
      </div>
      {/* Bar */}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: interp.color }}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SoilData() {
  const { fields, farms } = useAppStore();
  const [soilData, setSoilData] = useState<Record<string, SoilAnalysis>>(loadAllSoil);
  const [selectedFieldId, setSelectedFieldId] = useState<string>(fields[0]?.id ?? '');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedField = fields.find(f => f.id === selectedFieldId);
  const selectedFarm = farms.find(f => f.id === selectedField?.farm_id);
  const currentSoil = selectedFieldId ? soilData[selectedFieldId] : undefined;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFieldId) return;
    setImporting(true);
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        if (!parsed || Object.keys(parsed).length === 0) {
          setImportMsg({ msg: 'Nenhum dado reconhecido no CSV. Verifique as colunas.', type: 'err' });
          return;
        }
        const analysis: SoilAnalysis = {
          fieldId: selectedFieldId,
          fieldName: selectedField?.name ?? 'Talhão',
          importedAt: new Date().toISOString(),
          ...parsed,
        };
        saveSoil(selectedFieldId, analysis);
        setSoilData(loadAllSoil());
        setImportMsg({ msg: `${Object.keys(parsed).length} parâmetros importados com sucesso!`, type: 'ok' });
      } catch {
        setImportMsg({ msg: 'Erro ao processar o arquivo CSV.', type: 'err' });
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setImportMsg({ msg: 'Erro ao ler o arquivo.', type: 'err' });
      setImporting(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDelete = (fieldId: string) => {
    if (!window.confirm('Remover análise de solo deste talhão?')) return;
    deleteSoil(fieldId);
    setSoilData(loadAllSoil());
    setImportMsg(null);
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' }); } catch { return iso; }
  };

  const badge = currentSoil ? getOverallBadge(currentSoil) : null;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>science</span>
            <h1 className="text-2xl font-black text-white">Análise de Solo</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Importe análises laboratoriais em CSV e visualize os parâmetros por talhão.
          </p>
        </div>

        {fields.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--muted)' }}>science</span>
            <div className="text-center">
              <p className="text-sm font-bold text-white mb-1">Nenhum talhão cadastrado</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Crie talhões no mapa para importar análises de solo.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Field selector */}
            <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Talhão Ativo</h2>
              <select
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white border focus:outline-none focus:border-[var(--primary)] transition-all"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                value={selectedFieldId}
                onChange={e => { setSelectedFieldId(e.target.value); setImportMsg(null); }}
              >
                {fields.map(f => {
                  const farm = farms.find(fm => fm.id === f.farm_id);
                  return (
                    <option key={f.id} value={f.id ?? ''}>
                      {farm ? `${farm.name} — ` : ''}{f.name ?? 'Talhão'}{f.areaHa ? ` (${f.areaHa.toFixed(1)} ha)` : ''}
                    </option>
                  );
                })}
              </select>

              {selectedField && (
                <div className="flex flex-wrap gap-3 items-center">
                  {selectedFarm && (
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                      {selectedFarm.name}
                    </span>
                  )}
                  {selectedField.cultura && (
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
                      {selectedField.cultura}
                    </span>
                  )}
                  {currentSoil && (
                    <span className="text-xs px-3 py-1 rounded-full ml-auto" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80' }}>
                      Análise importada em {fmtDate(currentSoil.importedAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Import section */}
              <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-bold text-white">Importar CSV de análise</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Colunas reconhecidas: pH, M.O.(%), P, K, Ca, Mg, Al, CTC, V(%), B, Cu, Fe, Mn, Zn.
                  Separadores: vírgula, ponto-e-vírgula ou tabulação. Primeira linha = cabeçalhos, segunda = valores.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                    id="soil-csv-input"
                  />
                  <label
                    htmlFor="soil-csv-input"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all hover:opacity-90"
                    style={{
                      background: importing ? 'rgba(255,255,255,0.06)' : 'var(--primary)',
                      color: importing ? 'var(--muted)' : '#fff',
                      pointerEvents: importing ? 'none' : undefined,
                    }}
                  >
                    {importing
                      ? <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      : <span className="material-symbols-outlined text-base">upload_file</span>}
                    {importing ? 'Importando...' : 'Importar CSV de análise'}
                  </label>
                  {currentSoil && (
                    <button
                      onClick={() => handleDelete(selectedFieldId)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-red-500/10"
                      style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      Remover
                    </button>
                  )}
                </div>

                {importMsg && (
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{
                      background: importMsg.type === 'ok' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                      border: `1px solid ${importMsg.type === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      color: importMsg.type === 'ok' ? '#4ade80' : '#f87171',
                    }}
                  >
                    <span className="material-symbols-outlined text-base">
                      {importMsg.type === 'ok' ? 'check_circle' : 'error'}
                    </span>
                    {importMsg.msg}
                  </div>
                )}
              </div>
            </div>

            {/* Analysis results */}
            {currentSoil ? (
              <div className="flex flex-col gap-5">
                {/* Overall badge */}
                {badge && (
                  <div
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                    style={{ background: badge.bg, border: `1px solid ${badge.color}30` }}
                  >
                    <span className="material-symbols-outlined text-xl" style={{ color: badge.color }}>{badge.icon}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: badge.color }}>{badge.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {currentSoil.fieldName} · Importado em {fmtDate(currentSoil.importedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Primary parameters */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Parâmetros Primários</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Gauge label="pH" value={currentSoil.ph} unit="" min={4} max={8} interpret={interpretPH} />
                    <Gauge label="Matéria Orgânica" value={currentSoil.mo} unit="%" min={0} max={60} interpret={interpretMO} />
                    <Gauge label="Sat. Bases (V%)" value={currentSoil.v} unit="%" min={0} max={100} interpret={interpretV} />
                    <Gauge label="Fósforo (P)" value={currentSoil.p} unit="mg/dm³" min={0} max={60} interpret={v => interpretGeneric(v, 12, 30)} />
                    <Gauge label="Potássio (K)" value={currentSoil.k} unit="mg/dm³" min={0} max={300} interpret={v => interpretGeneric(v, 60, 180)} />
                    <Gauge label="CTC" value={currentSoil.ctc} unit="cmolc/dm³" min={0} max={20} interpret={v => interpretGeneric(v, 4, 12)} />
                  </div>
                </div>

                {/* Secondary parameters */}
                {(currentSoil.ca !== undefined || currentSoil.mg !== undefined || currentSoil.al !== undefined) && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Bases Trocáveis</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Gauge label="Cálcio (Ca)" value={currentSoil.ca} unit="cmolc/dm³" min={0} max={8} interpret={v => interpretGeneric(v, 1.5, 5)} />
                      <Gauge label="Magnésio (Mg)" value={currentSoil.mg} unit="cmolc/dm³" min={0} max={4} interpret={v => interpretGeneric(v, 0.5, 2)} />
                      <Gauge label="Alumínio (Al)" value={currentSoil.al} unit="cmolc/dm³" min={0} max={3}
                        interpret={v => v <= 0.2 ? { label: 'Baixo', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' } : { label: 'Alto', color: '#f87171', bg: 'rgba(239,68,68,0.12)' }} />
                    </div>
                  </div>
                )}

                {/* Micronutrients */}
                {(currentSoil.b !== undefined || currentSoil.cu !== undefined || currentSoil.fe !== undefined || currentSoil.mn !== undefined || currentSoil.zn !== undefined) && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Micronutrientes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Gauge label="Boro (B)" value={currentSoil.b} unit="mg/dm³" min={0} max={2} interpret={v => interpretGeneric(v, 0.2, 0.6)} />
                      <Gauge label="Cobre (Cu)" value={currentSoil.cu} unit="mg/dm³" min={0} max={10} interpret={v => interpretGeneric(v, 0.4, 2)} />
                      <Gauge label="Ferro (Fe)" value={currentSoil.fe} unit="mg/dm³" min={0} max={100} interpret={v => interpretGeneric(v, 9, 50)} />
                      <Gauge label="Manganês (Mn)" value={currentSoil.mn} unit="mg/dm³" min={0} max={60} interpret={v => interpretGeneric(v, 2, 30)} />
                      <Gauge label="Zinco (Zn)" value={currentSoil.zn} unit="mg/dm³" min={0} max={10} interpret={v => interpretGeneric(v, 0.6, 3)} />
                    </div>
                  </div>
                )}
              </div>
            ) : selectedField ? (
              <div className="flex flex-col items-center gap-4 py-12 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(236,91,19,0.10)' }}>
                  <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--primary)' }}>upload_file</span>
                </div>
                <div className="text-center px-6">
                  <p className="text-sm font-bold text-white mb-1">Nenhuma análise importada para este talhão</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Importe um arquivo CSV com os resultados da análise laboratorial para visualizar os parâmetros.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Analyses summary list */}
            {Object.keys(soilData).length > 0 && (
              <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Análises Cadastradas</h2>
                <div className="flex flex-col gap-2">
                  {Object.values(soilData).map(a => {
                    const b = getOverallBadge(a);
                    const field = fields.find(f => f.id === a.fieldId);
                    const farm = farms.find(f => f.id === field?.farm_id);
                    return (
                      <div
                        key={a.fieldId}
                        className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5"
                        style={{ background: selectedFieldId === a.fieldId ? 'rgba(236,91,19,0.06)' : 'rgba(255,255,255,0.01)', border: `1px solid ${selectedFieldId === a.fieldId ? 'var(--primary-border)' : 'var(--border)'}` }}
                        onClick={() => setSelectedFieldId(a.fieldId)}
                      >
                        <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: b.color }}>{b.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.fieldName}</p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            {farm?.name ? `${farm.name} · ` : ''}{fmtDate(a.importedAt)}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: b.bg, color: b.color }}>
                          {b.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
