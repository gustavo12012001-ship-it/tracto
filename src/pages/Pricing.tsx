// src/pages/Pricing.tsx - Tela de planos + assinatura via Mercado Pago
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import BillingProfileModal from '../components/BillingProfileModal';
import { useConfirm } from '../components/ui/useConfirm';
import { toast } from '../components/ui/Toast';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly_brl: number;
  price_yearly_brl: number;
  max_fields: number;
  max_farms: number;
  has_ia_chat: boolean;
  has_satellite: boolean;
  has_whatsapp: boolean;
  has_push: boolean;
  display_order: number;
  is_active: boolean;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: 'monthly' | 'yearly';
  current_period_end: string | null;
  trial_end_at: string | null;
  mp_preapproval_id: string | null;
}

interface BillingProfile {
  full_name: string;
  document_type: 'CPF' | 'CNPJ';
  document_number: string;
  email: string;
}

interface CheckoutResponse {
  subscription_id: string;
  mp_preapproval_id: string;
  checkout_url: string;
  sandbox_url?: string;
  environment: 'sandbox' | 'production';
}

const PLAN_COLORS: Record<string, { color: string; bg: string }> = {
  free: { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  pro: { color: '#ec5b13', bg: 'rgba(236,91,19,0.10)' },
  enterprise: { color: '#a855f7', bg: 'rgba(168,85,247,0.10)' },
};

function cleanText(value: string | null | undefined): string {
  if (!value) return '';
  const replacements: Record<string, string> = {
    '\u00c3\u00a1': 'á',
    '\u00c3 ': 'à',
    '\u00c3\u00a2': 'â',
    '\u00c3\u00a3': 'ã',
    '\u00c3\u00a9': 'é',
    '\u00c3\u00aa': 'ê',
    '\u00c3\u00ad': 'í',
    '\u00c3\u00b3': 'ó',
    '\u00c3\u00b4': 'ô',
    '\u00c3\u00b5': 'õ',
    '\u00c3\u00ba': 'ú',
    '\u00c3\u00a7': 'ç',
    '\u00c3\u0081': 'Á',
    '\u00c3\u0089': 'É',
    '\u00c3\u0093': 'Ó',
    '\u00c3\u0087': 'Ç',
    '\u00c2\u00b7': '·',
    '\u00e2\u0080\u00a6': '...',
    '\u00e2\u009c\u0093': '✓',
  };
  return Object.entries(replacements).reduce(
    (text, [broken, fixed]) => text.split(broken).join(fixed),
    value,
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string>('free');
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'card' | 'pix'>('card');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, subRes, profRes] = await Promise.allSettled([
        apiFetch<{ plans: Plan[] }>('/api/billing/plans'),
        apiFetch<{ subscription: Subscription | null; plan_id: string }>('/api/billing/subscription'),
        apiFetch<{ profile: BillingProfile | null }>('/api/billing/profile'),
      ]);

      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.plans);
      }
      if (subRes.status === 'fulfilled') {
        setCurrentSubscription(subRes.value.subscription);
        setCurrentPlanId(subRes.value.plan_id);
      }
      if (profRes.status === 'fulfilled') {
        setBillingProfile(profRes.value.profile);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar planos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const redirectToCheckout = (resp: CheckoutResponse) => {
    const url = resp.environment === 'sandbox' && resp.sandbox_url
      ? resp.sandbox_url
      : resp.checkout_url;
    window.location.href = url;
  };

  const startCheckout = async (planId: string) => {
    setError(null);
    if (!billingProfile) {
      setPendingPlanId(planId);
      setPendingPaymentMethod('card');
      setShowProfileModal(true);
      return;
    }
    setCheckoutLoading(`card:${planId}`);
    try {
      const resp = await apiFetch<CheckoutResponse>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      redirectToCheckout(resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao iniciar checkout.';
      setError(msg);
      setCheckoutLoading(null);
    }
  };

  const startPixCheckout = async (planId: string) => {
    setError(null);
    if (!billingProfile) {
      setPendingPlanId(planId);
      setPendingPaymentMethod('pix');
      setShowProfileModal(true);
      return;
    }
    setCheckoutLoading(`pix:${planId}`);
    try {
      const resp = await apiFetch<CheckoutResponse>('/api/billing/checkout-pix', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      redirectToCheckout(resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar pagamento Pix.';
      setError(msg);
      setCheckoutLoading(null);
    }
  };

  const cancelSubscription = async () => {
    const ok = await confirm({
      title: 'Cancelar assinatura?',
      message: 'Seu acesso aos recursos premium será encerrado ao fim do período atual. Esta ação pode ser revertida assinando novamente.',
      confirmLabel: 'Sim, cancelar',
      cancelLabel: 'Manter assinatura',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch('/api/billing/cancel', { method: 'POST' });
      toast.success('Assinatura cancelada.');
      await fetchAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao cancelar.';
      setError(msg);
      toast.error(msg);
    }
  };

  const onProfileSaved = async (planId: string | null) => {
    setShowProfileModal(false);
    await fetchAll();
    if (planId) {
      if (pendingPaymentMethod === 'pix') await startPixCheckout(planId);
      else await startCheckout(planId);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs hover:opacity-80"
            style={{ color: 'var(--muted)' }}
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Voltar
          </button>
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            7 DIAS DE TRIAL GRÁTIS
          </span>
        </div>

        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text)' }}>
          Escolha seu plano
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Tecnologia AgTech profissional. Cancele quando quiser.
        </p>

        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: billingCycle === 'monthly' ? 'var(--primary)' : 'var(--surface)',
              color: billingCycle === 'monthly' ? '#fff' : 'var(--muted)',
              border: `1px solid ${billingCycle === 'monthly' ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: billingCycle === 'yearly' ? 'var(--primary)' : 'var(--surface)',
              color: billingCycle === 'yearly' ? '#fff' : 'var(--muted)',
              border: `1px solid ${billingCycle === 'yearly' ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            Anual
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}
            >
              -20%
            </span>
          </button>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>error</span>
            <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}

        {currentSubscription && currentSubscription.status !== 'cancelled' && (
          <div
            className="mb-6 rounded-2xl p-4"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: '#22c55e' }}>
                  ✓ Assinatura ativa: {cleanText(plans.find(p => p.id === currentSubscription.plan_id)?.name) || currentSubscription.plan_id}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                  Ciclo: {currentSubscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                  {currentSubscription.current_period_end && (
                    <> · Próxima cobrança: {new Date(currentSubscription.current_period_end).toLocaleDateString('pt-BR')}</>
                  )}
                  {currentSubscription.status === 'pending' && <> · Aguardando pagamento</>}
                </p>
              </div>
              <button
                onClick={() => void cancelSubscription()}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                Cancelar assinatura
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const color = PLAN_COLORS[plan.id] ?? PLAN_COLORS.free;
            const price = billingCycle === 'monthly' ? plan.price_monthly_brl : plan.price_yearly_brl;
            const monthlyEquivalent = billingCycle === 'yearly' ? price / 12 : price;
            const isCurrent = plan.id === currentPlanId;
            const isHighlighted = plan.id === 'pro';
            const isFree = plan.id === 'free';
            const planName = cleanText(plan.name);

            return (
              <div
                key={plan.id}
                className="rounded-2xl p-6 flex flex-col"
                style={{
                  background: 'var(--surface)',
                  border: `2px solid ${isHighlighted ? color.color : 'var(--border)'}`,
                  boxShadow: isHighlighted ? `0 4px 20px ${color.color}25` : 'none',
                }}
              >
                {isHighlighted && (
                  <span
                    className="self-start text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full mb-3"
                    style={{ background: color.bg, color: color.color }}
                  >
                    Mais popular
                  </span>
                )}

                <h3 className="text-xl font-black mb-1" style={{ color: 'var(--text)' }}>{planName}</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{cleanText(plan.description)}</p>

                <div className="mb-4">
                  {isFree ? (
                    <p className="text-3xl font-black" style={{ color: 'var(--text)' }}>R$ 0</p>
                  ) : (
                    <>
                      <p className="text-3xl font-black" style={{ color: 'var(--text)' }}>
                        R$ {monthlyEquivalent.toFixed(2).replace('.', ',')}
                        <span className="text-sm font-normal" style={{ color: 'var(--muted)' }}>/mês</span>
                      </p>
                      {billingCycle === 'yearly' && (
                        <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                          R$ {price.toFixed(2).replace('.', ',')} cobrados anualmente
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="flex-1 space-y-2 mb-6">
                  <FeatureItem ok={plan.max_fields > 0}>
                    {plan.max_fields >= 999 ? 'Talhões ilimitados' : `${plan.max_fields} talhão(ões)`}
                  </FeatureItem>
                  <FeatureItem ok={plan.has_ia_chat}>Tracto IA agronômica</FeatureItem>
                  <FeatureItem ok={plan.has_satellite}>Imagens Sentinel-2 e NDVI</FeatureItem>
                  <FeatureItem ok={plan.has_push}>Notificações em tempo real</FeatureItem>
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                  >
                    ✓ Plano atual
                  </button>
                ) : isFree ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl text-sm font-bold opacity-60"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                  >
                    Sem necessidade de pagamento
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => void startCheckout(plan.id)}
                      disabled={checkoutLoading === `card:${plan.id}` || checkoutLoading === `pix:${plan.id}`}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                      style={{ background: color.color, boxShadow: `0 2px 12px ${color.color}40` }}
                    >
                      {checkoutLoading === `card:${plan.id}` ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                          Redirecionando...
                        </span>
                      ) : (
                        `Assinar ${planName} no cartão`
                      )}
                    </button>
                    <button
                      onClick={() => void startPixCheckout(plan.id)}
                      disabled={checkoutLoading === `card:${plan.id}` || checkoutLoading === `pix:${plan.id}`}
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-60"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      {checkoutLoading === `pix:${plan.id}` ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin inline-block" />
                          Gerando Pix...
                        </span>
                      ) : (
                        `Pagar ${billingCycle === 'yearly' ? '1 ano' : '30 dias'} no Pix`
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
          <TrustBadge icon="lock" title="Pagamento seguro" desc="Processado pelo Mercado Pago" />
          <TrustBadge icon="schedule" title="Sem fidelidade" desc="Cancele quando quiser" />
          <TrustBadge icon="receipt_long" title="Nota fiscal" desc="Emitida automaticamente" />
        </div>

        <p className="text-[10px] text-center mt-6" style={{ color: 'var(--muted)' }}>
          Métodos aceitos: cartão de crédito para assinatura recorrente ou Pix para acesso avulso do período selecionado.
          Suporte: contato@tractoagro.com.br ·{' '}
          <button
            type="button"
            onClick={() => navigate('/cancellation-policy')}
            className="underline hover:opacity-80"
          >
            Consulte cancelamento, reembolso e responsabilidade agronômica antes de assinar.
          </button>
        </p>
      </div>

      {showProfileModal && (
        <BillingProfileModal
          initialProfile={billingProfile}
          onClose={() => { setShowProfileModal(false); setPendingPlanId(null); }}
          onSaved={() => void onProfileSaved(pendingPlanId)}
        />
      )}
    </div>
  );
}

function FeatureItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs" style={{ color: ok ? 'var(--text)' : 'var(--muted)', opacity: ok ? 1 : 0.5 }}>
      <span
        className="material-symbols-outlined flex-shrink-0 mt-0.5"
        style={{ fontSize: 16, color: ok ? '#22c55e' : '#94a3b8' }}
      >
        {ok ? 'check_circle' : 'remove_circle_outline'}
      </span>
      <span className="leading-tight">{children}</span>
    </li>
  );
}

function TrustBadge({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>{icon}</span>
      <div>
        <p className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>{title}</p>
        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{desc}</p>
      </div>
    </div>
  );
}
