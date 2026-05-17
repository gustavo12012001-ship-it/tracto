/**
 * BillingProfileModal — Modal pra coletar CPF/CNPJ + endereço antes de assinar.
 *
 * Mercado Pago exige esses dados pra emitir cobrança e nota fiscal.
 * Salvo via POST /api/billing/profile.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';

interface BillingProfile {
  full_name: string;
  document_type: 'CPF' | 'CNPJ';
  document_number: string;
  email: string;
  phone?: string | null;
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
}

interface Props {
  initialProfile: BillingProfile | null;
  onClose: () => void;
  onSaved: (profile: BillingProfile) => void;
}

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
}
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3');
}

export default function BillingProfileModal({ initialProfile, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BillingProfile>({
    full_name: initialProfile?.full_name ?? '',
    document_type: initialProfile?.document_type ?? 'CPF',
    document_number: initialProfile?.document_number ?? '',
    email: initialProfile?.email ?? '',
    phone: initialProfile?.phone ?? '',
    address_zip: initialProfile?.address_zip ?? '',
    address_street: initialProfile?.address_street ?? '',
    address_number: initialProfile?.address_number ?? '',
    address_complement: initialProfile?.address_complement ?? '',
    address_district: initialProfile?.address_district ?? '',
    address_city: initialProfile?.address_city ?? '',
    address_state: initialProfile?.address_state ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // Autopreenche endereço via CEP (ViaCEP)
  const lookupCep = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await r.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          address_street: data.logradouro || f.address_street,
          address_district: data.bairro || f.address_district,
          address_city: data.localidade || f.address_city,
          address_state: data.uf || f.address_state,
        }));
      }
    } catch {
      // silently fail
    } finally {
      setCepLoading(false);
    }
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const validate = (): string | null => {
    if (!form.full_name.trim()) return 'Nome completo é obrigatório.';
    const doc = form.document_number.replace(/\D/g, '');
    if (form.document_type === 'CPF' && doc.length !== 11) return 'CPF deve ter 11 dígitos.';
    if (form.document_type === 'CNPJ' && doc.length !== 14) return 'CNPJ deve ter 14 dígitos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email inválido.';
    if (!form.address_zip || form.address_zip.replace(/\D/g, '').length !== 8) return 'CEP é obrigatório (8 dígitos).';
    if (!form.address_street?.trim()) return 'Endereço é obrigatório.';
    if (!form.address_number?.trim()) return 'Número é obrigatório.';
    if (!form.address_city?.trim()) return 'Cidade é obrigatória.';
    if (!form.address_state?.trim() || form.address_state.length !== 2) return 'UF é obrigatória (2 letras).';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);
    try {
      const resp = await apiFetch<{ profile: BillingProfile }>('/api/billing/profile', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          document_number: form.document_number.replace(/\D/g, ''),
          address_zip: (form.address_zip || '').replace(/\D/g, ''),
          phone: (form.phone || '').replace(/\D/g, ''),
        }),
      });
      onSaved(resp.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        className="glass-overlay rounded-2xl w-full max-w-sm md:max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>Complete seu cadastro</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Dados obrigatórios pra emissão da cobrança via Mercado Pago.
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>close</span>
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg flex items-center gap-2"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>error</span>
              <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
            </div>
          )}

          <Field label="Nome completo *">
            <input
              className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Como aparece no documento"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <select
                className="tracto-select w-full rounded-lg px-3 py-2 text-sm"
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value as 'CPF' | 'CNPJ', document_number: '' })}>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </Field>
            <Field label={`${form.document_type} *`} colSpan={2}>
              <input
                className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                value={form.document_number}
                onChange={(e) => setForm({
                  ...form,
                  document_number: form.document_type === 'CPF' ? maskCPF(e.target.value) : maskCNPJ(e.target.value),
                })}
                placeholder={form.document_type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email *">
              <input
                type="email"
                className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="seu@email.com"
              />
            </Field>
            <Field label="Telefone">
              <input
                className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                placeholder="(11) 99999-9999"
              />
            </Field>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
              Endereço de cobrança
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="CEP *">
                <div className="relative">
                  <input
                    className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                    value={form.address_zip || ''}
                    onChange={(e) => {
                      const v = maskCEP(e.target.value);
                      setForm({ ...form, address_zip: v });
                      if (v.replace(/\D/g, '').length === 8) void lookupCep(v);
                    }}
                    placeholder="00000-000"
                  />
                  {cepLoading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  )}
                </div>
              </Field>
              <Field label="Logradouro *" colSpan={2}>
                <input
                  className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                  value={form.address_street || ''}
                  onChange={(e) => setForm({ ...form, address_street: e.target.value })}
                  placeholder="Rua, Av, Travessa..."
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Número *">
                <input
                  className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                  value={form.address_number || ''}
                  onChange={(e) => setForm({ ...form, address_number: e.target.value })}
                  placeholder="123"
                />
              </Field>
              <Field label="Complemento" colSpan={2}>
                <input
                  className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                  value={form.address_complement || ''}
                  onChange={(e) => setForm({ ...form, address_complement: e.target.value })}
                  placeholder="Apto, sala, casa..."
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Bairro">
                <input
                  className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                  value={form.address_district || ''}
                  onChange={(e) => setForm({ ...form, address_district: e.target.value })}
                />
              </Field>
              <Field label="Cidade *">
                <input
                  className="tracto-input w-full rounded-lg px-3 py-2 text-sm"
                  value={form.address_city || ''}
                  onChange={(e) => setForm({ ...form, address_city: e.target.value })}
                />
              </Field>
              <Field label="UF *">
                <select
                  className="tracto-select w-full rounded-lg px-3 py-2 text-sm"
                  value={form.address_state || ''}
                  onChange={(e) => setForm({ ...form, address_state: e.target.value })}>
                  <option value="">—</option>
                  {BR_STATES.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                </select>
              </Field>
            </div>
          </div>

          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            🔒 Seus dados são criptografados e armazenados de forma segura.
            Usamos apenas pra emissão da cobrança via Mercado Pago.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            Cancelar
          </button>
          <button onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--primary)' }}>
            {saving ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">save</span>
                Salvar e continuar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, colSpan = 1, children }: { label: string; colSpan?: number; children: React.ReactNode }) {
  return (
    <div className={colSpan > 1 ? `col-span-${colSpan}` : ''}>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
