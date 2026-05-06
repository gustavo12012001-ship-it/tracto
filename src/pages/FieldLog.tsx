import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { apiFetch } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FieldLog {
  id: string;
  logged_at: string;
  operation_type: string;
  product?: string;
  dose?: string;
  area_ha?: number;
  cost?: number;
  notes?: string;
}

type OperationType =
  | 'Pulverização'
  | 'Adubação'
  | 'Irrigação'
  | 'Colheita'
  | 'Observação'
  | 'Outro';

const OPERATION_TYPES: OperationType[] = [
  'Pulverização',
  'Adubação',
  'Irrigação',
  'Colheita',
  'Observação',
  'Outro',
];

function getBadgeStyle(type: string): { background: string; color: string } {
  switch (type.toLowerCase()) {
    case 'pulverização':
      return { background: 'rgba(249,115,22,0.15)', color: '#f97316' };
    case 'adubação':
      return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
    case 'irrigação':
      return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };
    case 'colheita':
      return { background: 'rgba(234,179,8,0.15)', color: '#eab308' };
    default:
      return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
  }
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Log Card ──────────────────────────────────────────────────────────────────
function LogCard({
  log,
  onDelete,
}: {
  log: FieldLog;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const badge = getBadgeStyle(log.operation_type);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-black"
            style={{ color: 'var(--primary)' }}
          >
            {formatDate(log.logged_at)}
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={badge}
          >
            {log.operation_type}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {confirming ? (
            <>
              <button
                onClick={() => onDelete(log.id)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg"
                style={{ background: 'var(--border)', color: 'var(--muted)' }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              title="Excluir registro"
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-red-500/10"
              style={{ color: 'var(--muted)' }}
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--muted)' }}>
        {log.product && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>science</span>
            {log.product}
            {log.dose ? ` · ${log.dose}` : ''}
          </span>
        )}
        {log.area_ha != null && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>crop_square</span>
            {log.area_ha} ha
          </span>
        )}
        {log.cost != null && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>payments</span>
            R$ {log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {log.notes && (
        <p className="text-[11px] leading-snug" style={{ color: 'var(--text, #e2e8f0)' }}>
          {log.notes}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FieldLog() {
  const { activeFieldId, fields } = useAppStore();
  const activeField = fields.find((f) => f.id === activeFieldId) ?? null;

  const [logs, setLogs] = useState<FieldLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(todayISO());
  const [formType, setFormType] = useState<OperationType>('Pulverização');
  const [formProduct, setFormProduct] = useState('');
  const [formDose, setFormDose] = useState('');
  const [formArea, setFormArea] = useState<string>(
    activeField?.areaHa != null ? String(activeField.areaHa) : ''
  );
  const [formCost, setFormCost] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!activeFieldId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FieldLog[]>(`/api/fields/${activeFieldId}/logs`);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar registros.');
    } finally {
      setLoading(false);
    }
  }, [activeFieldId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Update area when activeField changes
  useEffect(() => {
    if (activeField?.areaHa != null) {
      setFormArea(String(activeField.areaHa));
    }
  }, [activeField?.areaHa]);

  const handleOpenForm = () => {
    setFormDate(todayISO());
    setFormType('Pulverização');
    setFormProduct('');
    setFormDose('');
    setFormArea(activeField?.areaHa != null ? String(activeField.areaHa) : '');
    setFormCost('');
    setFormNotes('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFieldId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/fields/${activeFieldId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logged_at: formDate,
          operation_type: formType,
          product: formProduct || undefined,
          dose: formDose || undefined,
          area_ha: formArea ? Number(formArea) : undefined,
          cost: formCost ? Number(formCost) : undefined,
          notes: formNotes || undefined,
        }),
      });
      setShowForm(false);
      void fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeFieldId) return;
    try {
      await apiFetch(`/api/fields/${activeFieldId}/logs/${id}`, { method: 'DELETE' });
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text, #e2e8f0)' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 md:px-6 py-4 border-b flex items-center justify-between gap-4"
        style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="material-symbols-outlined text-xl"
              style={{ color: 'var(--primary)' }}
            >
              book
            </span>
            <h1
              className="text-base font-bold tracking-tight"
              style={{ color: 'var(--text, #e2e8f0)' }}
            >
              Caderno de Campo
            </h1>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {activeField
              ? `Talhão: ${activeField.name}${activeField.areaHa != null ? ` · ${activeField.areaHa} ha` : ''}`
              : 'Registros de operações por talhão'}
          </p>
        </div>
        {activeFieldId && (
          <button
            onClick={handleOpenForm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex-shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            <span className="material-symbols-outlined text-base">add</span>
            Registrar
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">

          {/* No active field */}
          {!activeFieldId && (
            <div
              className="flex flex-col items-center gap-3 py-16 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <span
                className="material-symbols-outlined text-5xl"
                style={{ opacity: 0.3 }}
              >
                book
              </span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>
                Nenhum talhão selecionado
              </p>
              <p className="text-xs text-center max-w-xs" style={{ color: 'var(--muted)' }}>
                Acesse <strong>Mapa / Talhões</strong> e selecione um talhão para visualizar e registrar operações.
              </p>
            </div>
          )}

          {/* Inline form */}
          {showForm && activeFieldId && (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>
                  Novo Registro
                </p>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ color: 'var(--muted)' }}
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)' }}
                  />
                </div>

                {/* Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Tipo
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as OperationType)}
                    className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)', background: 'var(--surface)' }}
                  >
                    {OPERATION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Product */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Produto
                  </label>
                  <input
                    type="text"
                    value={formProduct}
                    onChange={(e) => setFormProduct(e.target.value)}
                    placeholder="Nome do produto"
                    className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)' }}
                  />
                </div>

                {/* Dose */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Dose
                  </label>
                  <input
                    type="text"
                    value={formDose}
                    onChange={(e) => setFormDose(e.target.value)}
                    placeholder="ex: 2 L/ha"
                    className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)' }}
                  />
                </div>

                {/* Area */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Área (ha)
                  </label>
                  <input
                    type="number"
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    min={0}
                    step="0.01"
                    className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)' }}
                  />
                </div>

                {/* Cost */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Custo (R$)
                  </label>
                  <input
                    type="number"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    min={0}
                    step="0.01"
                    placeholder="R$"
                    className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  Observações
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Anotações, condições do campo, observações..."
                  className="rounded-xl px-3 py-2 text-sm bg-transparent border outline-none resize-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text, #e2e8f0)' }}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  {submitting ? (
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">save</span>
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 p-4 rounded-xl"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444',
              }}
            >
              <span className="material-symbols-outlined text-base">error</span>
              <p className="text-xs flex-1">{error}</p>
              <button onClick={() => setError(null)}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && activeFieldId && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 animate-pulse"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    height: 90,
                  }}
                />
              ))}
            </div>
          )}

          {/* Log list */}
          {!loading && activeFieldId && logs.length > 0 && (
            <div className="flex flex-col gap-3">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--muted)' }}
              >
                {logs.length} registro{logs.length !== 1 ? 's' : ''}
              </p>
              {logs.map((log) => (
                <LogCard key={log.id} log={log} onDelete={(id) => void handleDelete(id)} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && activeFieldId && logs.length === 0 && !showForm && (
            <div
              className="flex flex-col items-center gap-3 py-16 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <span
                className="material-symbols-outlined text-5xl"
                style={{ opacity: 0.3 }}
              >
                edit_note
              </span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>
                Nenhum registro ainda
              </p>
              <p
                className="text-xs text-center max-w-xs"
                style={{ color: 'var(--muted)' }}
              >
                Clique em <strong>+ Registrar</strong> para adicionar a primeira operação deste talhão.
              </p>
              <button
                onClick={handleOpenForm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                <span className="material-symbols-outlined text-base">add</span>
                Registrar operação
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
