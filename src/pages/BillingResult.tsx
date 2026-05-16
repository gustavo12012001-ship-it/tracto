// src/pages/BillingResult.tsx — Páginas de retorno do checkout Mercado Pago.
// /app/billing/success, /app/billing/failed, /app/billing/pending
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../services/api';

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  trial_end_at: string | null;
}

type Variant = 'success' | 'failed' | 'pending';

export default function BillingResult({ variant }: { variant: Variant }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Polling rápido: webhook do MP pode levar alguns segundos pra chegar
    let attempts = 0;
    const maxAttempts = 8;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const r = await apiFetch<{ subscription: Subscription | null }>('/api/billing/subscription');
        if (r.subscription) {
          setSubscription(r.subscription);
          if (r.subscription.status === 'authorized' || attempts >= maxAttempts) {
            clearInterval(interval);
            setLoading(false);
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setLoading(false);
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setLoading(false);
        }
      }
    }, 2000);

    // Para inicial rápido (não espera 2s)
    void (async () => {
      try {
        const r = await apiFetch<{ subscription: Subscription | null }>('/api/billing/subscription');
        setSubscription(r.subscription);
      } catch { /* ignore */ }
    })();

    return () => clearInterval(interval);
  }, []);

  const config = {
    success: {
      icon: 'check_circle',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.10)',
      title: 'Pagamento confirmado!',
      message: 'Sua assinatura está ativa. Aproveite todos os recursos da Tracto AgTech.',
    },
    failed: {
      icon: 'error',
      color: '#f87171',
      bg: 'rgba(239,68,68,0.10)',
      title: 'Pagamento não autorizado',
      message: 'Não conseguimos processar seu pagamento. Verifique os dados do cartão ou tente outro método.',
    },
    pending: {
      icon: 'schedule',
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.10)',
      title: 'Aguardando confirmação',
      message: 'Seu pagamento está sendo processado. Você receberá um email assim que for confirmado.',
    },
  }[variant];

  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-md w-full rounded-2xl p-8 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: config.bg }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: config.color }}>
            {config.icon}
          </span>
        </div>

        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>{config.title}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{config.message}</p>

        {/* Status atual */}
        {loading && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Sincronizando com o Mercado Pago…</p>
          </div>
        )}

        {subscription && (
          <div className="rounded-xl p-3 mb-6 text-left"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
              Status atual
            </p>
            <p className="text-sm font-bold capitalize" style={{ color: 'var(--text)' }}>
              {subscription.plan_id} · {subscription.status}
            </p>
            {subscription.current_period_end && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                Próxima cobrança: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Subscription ID (debug + suporte) */}
        {params.get('sub') && (
          <p className="text-[10px] mb-4" style={{ color: 'var(--muted)' }}>
            Ref: <code>{params.get('sub')}</code>
          </p>
        )}

        <div className="flex gap-2 justify-center">
          {variant === 'success' ? (
            <button onClick={() => navigate('/app/dashboard')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--primary)' }}>
              Ir pro Dashboard
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/app/billing')}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--primary)' }}>
                Tentar novamente
              </button>
              <button onClick={() => navigate('/app/dashboard')}
                className="px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Voltar
              </button>
            </>
          )}
        </div>

        {variant !== 'success' && (
          <p className="text-[10px] mt-6" style={{ color: 'var(--muted)' }}>
            Precisa de ajuda? <a href="mailto:contato@tractoagro.com.br" className="underline">contato@tractoagro.com.br</a>
          </p>
        )}
      </div>
    </div>
  );
}

export function BillingSuccess() { return <BillingResult variant="success" />; }
export function BillingFailed() { return <BillingResult variant="failed" />; }
export function BillingPending() { return <BillingResult variant="pending" />; }
