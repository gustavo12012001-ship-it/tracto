import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

interface Entitlements {
  max_fields: number;
  can_use_whatsapp: boolean;
  can_use_push: boolean;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para começar a explorar',
    color: '#64748b',
    features: [
      '1 Talhão Ativo',
      'Análises Básicas de IA',
      'Chat Agronômico Limitado',
      'Alertas Climáticos',
      'Mapa de Talhões',
    ],
    missing: ['WhatsApp IA', 'Push Notifications', 'Exportação de Mapas'],
    cta: 'Plano Atual',
    planKey: null,
    highlighted: false,
  },
  {
    id: 'familiar',
    name: 'Familiar',
    price: 'R$ 199',
    period: '/mês',
    description: 'Para pequenas propriedades',
    color: '#3b82f6',
    badge: 'Popular',
    features: [
      'Até 5 Talhões',
      'Análises Completas de IA',
      'Chat Agronômico Ilimitado',
      'Alertas Climáticos + Pragas',
      'Histórico de Conversas',
      'Relatórios em PDF',
    ],
    missing: ['WhatsApp IA', 'Push Notifications'],
    cta: 'Assinar Familiar',
    planKey: 'familiar',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Profissional',
    price: 'R$ 499',
    period: '/mês',
    description: 'Para produtores exigentes',
    color: '#ec5b13',
    badge: 'Recomendado',
    features: [
      'Talhões Ilimitados',
      'IA Completa + Imagens Satélite',
      'Chat Agronômico Ilimitado',
      'Alertas em Tempo Real',
      'WhatsApp IA (Em breve)',
      'Push Notifications',
      'Relatórios Avançados',
      'Exportação de Mapas',
    ],
    missing: [],
    cta: 'Assinar Profissional',
    planKey: 'pro',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    description: 'Para cooperativas e grandes grupos',
    color: '#a855f7',
    features: [
      'Tudo do Profissional',
      'Multi-Usuários e Equipes',
      'Integrações Customizadas',
      'API de Dados Agronômicos',
      'Suporte Dedicado 24/7',
      'SLA Garantido',
      'Onboarding Personalizado',
    ],
    missing: [],
    cta: 'Falar com Comercial',
    planKey: 'enterprise',
    highlighted: false,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Pricing() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    apiFetch<Entitlements>('/api/billing/entitlements')
      .then(setEntitlements)
      .catch(console.error);
  }, []);

  const currentPlanId = (): string => {
    if (!entitlements) return 'free';
    if (entitlements.max_fields > 5) return 'pro';
    if (entitlements.max_fields > 1) return 'familiar';
    return 'free';
  };

  const handleCheckout = async (planKey: string) => {
    if (planKey === 'enterprise') {
      window.open('mailto:contato@tractoagro.com.br?subject=Interesse%20Enterprise', '_blank');
      return;
    }
    setLoading(planKey);
    setMessage(null);
    try {
      const res = await apiFetch<{ checkout_url: string; message: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planKey, payment_method: 'pix' }),
      });
      if (res.checkout_url && res.checkout_url !== '#') {
        window.location.href = res.checkout_url;
      } else {
        setMessage({ text: res.message + ' — Integração aguardando ativação do gateway de pagamento.', ok: false });
      }
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : 'Erro ao iniciar checkout.', ok: false });
    } finally {
      setLoading(null);
    }
  };

  const subscribePush = async () => {
    setMessage(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setMessage({ text: 'Seu navegador não suporta Web Push.', ok: false });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage({ text: 'Permissão para notificações negada.', ok: false });
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const rawVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!rawVapidKey) throw new Error('VITE_VAPID_PUBLIC_KEY não configurada.');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(rawVapidKey),
      });
      const subJson = subscription.toJSON();
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: subJson.endpoint, p256dh: subJson.keys?.p256dh || '', auth: subJson.keys?.auth || '' }),
      });
      setMessage({ text: 'Aparelho registrado para notificações Push!', ok: true });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Erro ao registrar Push.', ok: false });
    }
  };

  const activePlan = currentPlanId();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-white">Assinatura e Planos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Escolha o plano ideal para sua operação agrícola.
          </p>
        </div>

        {/* Current plan banner */}
        {entitlements && (
          <div
            className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>verified</span>
              <div>
                <p className="text-xs uppercase font-bold tracking-widest" style={{ color: 'var(--muted)' }}>Seu Plano Atual</p>
                <p className="text-sm font-black text-white capitalize">{activePlan === 'free' ? 'Gratuito' : activePlan === 'familiar' ? 'Familiar' : 'Profissional'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="text-white">
                <span style={{ color: 'var(--muted)' }}>Talhões: </span>
                <strong>{entitlements.max_fields === 9999 ? 'Ilimitados' : entitlements.max_fields}</strong>
              </span>
              <span className="text-white">
                <span style={{ color: 'var(--muted)' }}>WhatsApp: </span>
                <strong>{entitlements.can_use_whatsapp ? '✅ Ativo' : '⛔ Bloqueado'}</strong>
              </span>
              <span className="text-white">
                <span style={{ color: 'var(--muted)' }}>Push: </span>
                <strong>{entitlements.can_use_push ? '✅ Ativo' : '⛔ Bloqueado'}</strong>
              </span>
            </div>
            {activePlan === 'free' && (
              <div className="w-full text-[11px] font-bold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(234,179,8,0.1)', color: '#fbbf24' }}>
                ⚠️ Você está no plano gratuito. Faça upgrade para remover os limites e acessar todas as funcionalidades.
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {message && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl text-sm font-semibold"
            style={{
              background: message.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${message.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: message.ok ? '#4ade80' : '#f87171',
            }}
          >
            <span className="material-symbols-outlined text-base">{message.ok ? 'check_circle' : 'error'}</span>
            {message.text}
          </div>
        )}

        {/* Plans grid */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === activePlan;
            const isHighlighted = plan.highlighted;
            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl p-5"
                style={{
                  background: isHighlighted ? 'rgba(236,91,19,0.05)' : 'var(--surface)',
                  border: `1px solid ${isHighlighted ? 'rgba(236,91,19,0.35)' : isCurrent ? `${plan.color}44` : 'var(--border)'}`,
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ background: plan.color }}
                  >
                    {plan.badge}
                  </div>
                )}
                {isCurrent && !plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ background: plan.color }}
                  >
                    Plano Atual
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-4">
                  <h3 className="text-base font-black text-white">{plan.name}</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{plan.description}</p>
                  <p className="text-2xl font-light text-white mt-3">
                    {plan.price}
                    {plan.period && <span className="text-sm" style={{ color: 'var(--muted)' }}>{plan.period}</span>}
                  </p>
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-2 mb-6 text-xs">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0" style={{ color: plan.color }}>check_circle</span>
                      <span style={{ color: '#cbd5e1' }}>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="flex items-start gap-2 opacity-40">
                      <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0" style={{ color: 'var(--muted)' }}>cancel</span>
                      <span style={{ color: 'var(--muted)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent && plan.id === 'free' ? (
                  <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: '#475569', cursor: 'not-allowed' }}>
                    Plano Atual
                  </button>
                ) : (
                  <button
                    onClick={() => plan.planKey && void handleCheckout(plan.planKey)}
                    disabled={loading === plan.planKey || isCurrent}
                    className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{
                      background: isCurrent ? `${plan.color}22` : plan.color,
                      color: isCurrent ? plan.color : '#fff',
                      border: isCurrent ? `1px solid ${plan.color}44` : 'none',
                    }}
                  >
                    {loading === plan.planKey && (
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    )}
                    {isCurrent ? 'Plano Atual' : plan.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Push notifications panel */}
        <div
          className="p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>notifications_active</span>
              Ativar Notificações Push neste Dispositivo
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Receba alertas agronômicos mesmo com o navegador fechado. Requer plano Profissional.
            </p>
          </div>
          <button
            onClick={() => void subscribePush()}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
            style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}
          >
            <span className="material-symbols-outlined text-base">add_alert</span>
            Registrar Este Dispositivo
          </button>
        </div>

        {/* Settings link */}
        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Para configurar alertas por e-mail e WhatsApp, acesse{' '}
          <Link to="/app/settings" style={{ color: 'var(--primary)' }} className="font-bold">
            Configurações → Notificações
          </Link>
        </p>
      </div>
    </div>
  );
}
