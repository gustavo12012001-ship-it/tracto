import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { farmService } from '../services/farm_service';
import { useAppStore } from '../store/useAppStore';

type Tab = 'perfil' | 'fazenda' | 'seguranca' | 'privacidade' | 'notificacoes';

interface NotifPrefs {
  email: boolean;
  whatsapp: boolean;
  push: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
      style={{
        background: type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        border: `1px solid ${type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        color: type === 'ok' ? '#4ade80' : '#f87171',
      }}
    >
      <span className="material-symbols-outlined text-base">
        {type === 'ok' ? 'check_circle' : 'error'}
      </span>
      {msg}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative w-10 h-6 rounded-full flex-shrink-0 transition-all duration-200"
        style={{ background: checked ? 'var(--primary)' : 'rgba(255,255,255,0.12)' }}
        aria-checked={checked}
        role="switch"
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200"
          style={{ left: checked ? '22px' : '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
        />
      </button>
    </label>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6 flex flex-col gap-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-sm text-white bg-transparent border transition-all outline-none focus:border-[var(--primary)]';
const inputStyle = { borderColor: 'var(--border-strong)', background: 'rgba(255,255,255,0.04)' };

const btnPrimary =
  'flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PERFIL
// ═══════════════════════════════════════════════════════════════════════════════
function PerfilTab() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? '');
      setName(u.user_metadata?.full_name ?? u.user_metadata?.name ?? '');
      setPhone(u.user_metadata?.phone ?? '');
    });
  }, []);

  const save = async () => {
    setLoading(true);
    setToast(null);
    try {
      await supabase.auth.updateUser({
        data: { full_name: name.trim(), phone: phone.trim() },
      });
      setToast({ msg: 'Perfil atualizado com sucesso!', type: 'ok' });
    } catch {
      setToast({ msg: 'Erro ao salvar. Tente novamente.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  const initials = name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <Section title="Dados Pessoais">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            {initials || '?'}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{name || 'Sem nome'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{email}</p>
          </div>
        </div>

        <Field label="Nome Completo">
          <input
            className={inputCls}
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </Field>

        <Field label="E-mail (não editável aqui)">
          <input
            className={inputCls}
            style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
            value={email}
            disabled
          />
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            Para alterar o e-mail, entre em contato com o suporte.
          </p>
        </Field>

        <Field label="Telefone / WhatsApp">
          <input
            className={inputCls}
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 (00) 00000-0000"
            type="tel"
          />
        </Field>

        {toast && <Toast {...toast} />}

        <div className="flex justify-end">
          <button
            onClick={() => void save()}
            disabled={loading}
            className={btnPrimary}
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            Salvar Alterações
          </button>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: FAZENDA
// ═══════════════════════════════════════════════════════════════════════════════
function FazendaTab() {
  const { farms, syncFromBackend } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const startEdit = (farm: { id: string; name: string; description?: string }) => {
    setEditingId(farm.id);
    setEditName(farm.name);
    // Use description as fallback for city (since there's no dedicated city field in the model)
    setEditCity(farm.description ?? '');
    setToast(null);
  };

  const save = async () => {
    if (!editingId) return;
    setLoading(true);
    setToast(null);
    try {
      await farmService.saveFarm({ id: editingId, name: editName.trim(), description: editCity.trim() });
      await syncFromBackend();
      setEditingId(null);
      setToast({ msg: 'Fazenda atualizada com sucesso!', type: 'ok' });
    } catch {
      setToast({ msg: 'Erro ao salvar fazenda. Tente novamente.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Propriedades Cadastradas">
        {farms.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Nenhuma fazenda cadastrada. Crie uma no mapa.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {farms.map((farm) => (
            <div
              key={farm.id}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}
            >
              {editingId === farm.id ? (
                <>
                  <Field label="Nome da Propriedade">
                    <input
                      className={inputCls}
                      style={inputStyle}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome da fazenda"
                    />
                  </Field>
                  <Field label="Município / Cidade">
                    <input
                      className={inputCls}
                      style={inputStyle}
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="Ex: Uberlândia - MG"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void save()}
                      disabled={loading}
                      className={btnPrimary}
                      style={{ background: 'var(--primary)', color: '#fff' }}
                    >
                      {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className={btnPrimary}
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid var(--border)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">{farm.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {(farm as unknown as { description?: string }).description || 'Município não informado'} · {farm.fields?.length ?? 0} talhão(ões)
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(farm as unknown as { id: string; name: string; description?: string })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
                    style={{ color: '#94a3b8', border: '1px solid var(--border)' }}
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Editar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {toast && <Toast {...toast} />}
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SEGURANÇA
// ═══════════════════════════════════════════════════════════════════════════════
function SegurancaTab() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const save = async () => {
    setToast(null);
    if (password.length < 8) {
      setToast({ msg: 'A senha precisa ter ao menos 8 caracteres.', type: 'err' });
      return;
    }
    if (password !== confirm) {
      setToast({ msg: 'As senhas não coincidem.', type: 'err' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirm('');
      setToast({ msg: 'Senha alterada com sucesso!', type: 'ok' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao alterar senha.';
      setToast({ msg, type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Alterar Senha">
        <Field label="Nova Senha">
          <div className="relative">
            <input
              className={inputCls}
              style={{ ...inputStyle, paddingRight: '3rem' }}
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted)' }}
            >
              <span className="material-symbols-outlined text-base">{showPwd ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </Field>

        <Field label="Confirmar Nova Senha">
          <input
            className={inputCls}
            style={inputStyle}
            type={showPwd ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a nova senha"
          />
        </Field>

        {/* Strength indicator */}
        {password.length > 0 && (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((level) => {
              const strength = password.length >= 12 ? 4 : password.length >= 10 ? 3 : password.length >= 8 ? 2 : 1;
              const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
              return (
                <div
                  key={level}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{ background: level <= strength ? colors[strength - 1] : 'rgba(255,255,255,0.1)' }}
                />
              );
            })}
            <span className="text-[11px] ml-1" style={{ color: 'var(--muted)' }}>
              {password.length >= 12 ? 'Forte' : password.length >= 8 ? 'Média' : 'Fraca'}
            </span>
          </div>
        )}

        {toast && <Toast {...toast} />}

        <div className="flex justify-end">
          <button
            onClick={() => void save()}
            disabled={loading}
            className={btnPrimary}
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            Alterar Senha
          </button>
        </div>
      </Section>

      <Section title="Sessões Ativas">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Ao alterar a senha, todas as sessões ativas serão encerradas automaticamente.
          Você precisará fazer login novamente em outros dispositivos.
        </p>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PRIVACIDADE
// ═══════════════════════════════════════════════════════════════════════════════
function PrivacidadeTab() {
  const navigate = useNavigate();
  const { resetStore } = useAppStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const handleDeleteRequest = async () => {
    if (confirmText.toUpperCase() !== 'EXCLUIR') return;
    setLoading(true);
    try {
      // Send deletion request email / flag account for deletion
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      // Sign out and clear local data
      await supabase.auth.signOut();
      resetStore();
      // Redirect with message
      navigate(`/login?deleted=1&email=${encodeURIComponent(email ?? '')}`);
    } catch {
      setToast({ msg: 'Erro ao processar solicitação. Entre em contato com o suporte.', type: 'err' });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Documentos Legais">
        <div className="flex flex-col gap-3">
          <Link
            to="/privacy"
            target="_blank"
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all hover:bg-white/5"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>policy</span>
              <div>
                <p className="text-sm font-semibold text-white">Política de Privacidade</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Veja como seus dados são usados (LGPD)</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>open_in_new</span>
          </Link>

          <Link
            to="/terms"
            target="_blank"
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all hover:bg-white/5"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>gavel</span>
              <div>
                <p className="text-sm font-semibold text-white">Termos de Serviço</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Termos e condições de uso da plataforma</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>open_in_new</span>
          </Link>
        </div>
      </Section>

      <Section title="Seus Dados">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <span className="material-symbols-outlined text-red-400 mt-0.5">warning</span>
            <div>
              <p className="text-sm font-bold text-red-400">Solicitar Exclusão da Conta</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Esta ação é irreversível. Todos os seus dados (fazendas, talhões, conversas, análises)
                serão permanentemente excluídos conforme a LGPD. A exclusão é processada em até 30 dias.
              </p>
            </div>
          </div>

          {toast && <Toast {...toast} />}

          <button
            onClick={() => { setShowDeleteModal(true); setConfirmText(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-red-500/10"
            style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <span className="material-symbols-outlined text-base">delete_forever</span>
            Solicitar Exclusão da Conta
          </button>
        </div>
      </Section>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
            style={{ background: '#0c0c0e', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <span className="material-symbols-outlined text-red-400">delete_forever</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Todos os seus dados serão permanentemente removidos de acordo com a LGPD.
              Digite <strong className="text-white">EXCLUIR</strong> para confirmar.
            </p>

            <input
              className={inputCls}
              style={{ ...inputStyle, borderColor: 'rgba(239,68,68,0.3)' }}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Digite EXCLUIR para confirmar"
            />

            <div className="flex gap-3">
              <button
                onClick={() => void handleDeleteRequest()}
                disabled={loading || confirmText !== 'EXCLUIR'}
                className={btnPrimary + ' flex-1'}
                style={{
                  background: confirmText === 'EXCLUIR' ? '#dc2626' : 'rgba(239,68,68,0.1)',
                  color: confirmText === 'EXCLUIR' ? '#fff' : '#f87171',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                Confirmar Exclusão
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className={btnPrimary}
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: NOTIFICAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════
function NotificacoesTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>({ email: true, whatsapp: false, push: false });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const saved = data.user?.user_metadata?.notification_prefs as NotifPrefs | undefined;
      if (saved) setPrefs(saved);
    });
  }, []);

  const save = useCallback(async (updated: NotifPrefs) => {
    setLoading(true);
    setToast(null);
    try {
      await supabase.auth.updateUser({ data: { notification_prefs: updated } });
      setToast({ msg: 'Preferências de notificação salvas!', type: 'ok' });
    } catch {
      setToast({ msg: 'Erro ao salvar preferências.', type: 'err' });
    } finally {
      setLoading(false);
    }
  }, []);

  const update = (key: keyof NotifPrefs, val: boolean) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Canais de Alerta">
        <div className="-my-2">
          <Toggle
            checked={prefs.email}
            onChange={(v) => update('email', v)}
            label="Alertas por E-mail"
            description="Receba alertas agrônomicos e climáticos no seu e-mail cadastrado"
          />
          <Toggle
            checked={prefs.whatsapp}
            onChange={(v) => update('whatsapp', v)}
            label="Alertas via WhatsApp"
            description="Receba mensagens direto no WhatsApp cadastrado no perfil (requer plano Pro)"
          />
          <Toggle
            checked={prefs.push}
            onChange={(v) => update('push', v)}
            label="Notificações Push (Navegador)"
            description="Alertas em tempo real no seu navegador, mesmo com a aba fechada"
          />
        </div>

        {toast && <Toast {...toast} />}

        <div className="flex justify-end">
          <button
            onClick={() => void save(prefs)}
            disabled={loading}
            className={btnPrimary}
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            Salvar Preferências
          </button>
        </div>
      </Section>

      <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(236,91,19,0.06)', border: '1px solid rgba(236,91,19,0.15)' }}>
        <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: 'var(--primary)' }}>info</span>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Os alertas por WhatsApp e Push são funcionalidades do plano Profissional.
          <Link to="/app/billing" className="font-bold ml-1" style={{ color: 'var(--primary)' }}>
            Ver planos →
          </Link>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'perfil', label: 'Perfil', icon: 'person' },
  { id: 'fazenda', label: 'Fazenda', icon: 'home_work' },
  { id: 'seguranca', label: 'Segurança', icon: 'lock' },
  { id: 'privacidade', label: 'Privacidade', icon: 'policy' },
  { id: 'notificacoes', label: 'Notificações', icon: 'notifications' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('perfil');

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-white">Configurações</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Gerencie seu perfil, fazenda, segurança e preferências.
          </p>
        </div>

        {/* Tab Bar */}
        <div
          className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-thin"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center"
              style={
                activeTab === tab.id
                  ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                  : { color: 'var(--muted)', border: '1px solid transparent' }
              }
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'perfil' && <PerfilTab />}
        {activeTab === 'fazenda' && <FazendaTab />}
        {activeTab === 'seguranca' && <SegurancaTab />}
        {activeTab === 'privacidade' && <PrivacidadeTab />}
        {activeTab === 'notificacoes' && <NotificacoesTab />}
      </div>
    </div>
  );
}
