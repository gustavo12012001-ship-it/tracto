import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

interface Entitlements {
  max_fields: number;
  can_use_whatsapp: boolean;
  can_use_push: boolean;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Pricing() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch<Entitlements>('/api/billing/entitlements')
      .then(setEntitlements)
      .catch(console.error);
  }, []);

  const handleCheckout = async (planId: string) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await apiFetch<{ checkout_url: string; message: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, payment_method: 'pix' })
      });
      setMessage(res.message + " (Integração estrutural pronta. Aguardando chaves do Gateway).");
      // MOCK: Em produção, window.location.href = res.checkout_url;
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const subscribePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setMessage('Seu navegador não suporta Web Push.');
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Permissão para notificações negada.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const rawVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!rawVapidKey) {
        throw new Error('VITE_VAPID_PUBLIC_KEY não está definida no ambiente. O registro push exige provisão real.');
      }
      
      const applicationServerKey = urlBase64ToUint8Array(rawVapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      const subJson = subscription.toJSON();
      
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || ''
        })
      });

      setMessage('Aparelho registrado com sucesso para notificações Push da Tracto!');
    } catch (err: any) {
      console.error(err);
      setMessage(`Erro na Inscrição Push: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6" style={{ background: '#080809' }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Assinatura e Recursos</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Gerencie seu plano atual e libere funcionalidades avançadas.
          </p>
        </div>

        {entitlements && (
          <div className="p-4 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Planos e Limites do seu Usuário</h2>
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-slate-300">Talhões permitidos: <span className="font-bold text-white">{entitlements.max_fields}</span></p>
              <p className="text-slate-300">Acesso via WhatsApp: <span className="font-bold text-white">{entitlements.can_use_whatsapp ? 'Liberado' : 'Bloqueado'}</span></p>
              <p className="text-slate-300">Push Notifications: <span className="font-bold text-white">{entitlements.can_use_push ? 'Liberado' : 'Bloqueado'}</span></p>
            </div>
            {entitlements.max_fields === 1 && (
              <p className="mt-4 text-[10px] text-amber-500 font-bold bg-amber-500/10 p-2 rounded">
                Você está no plano Gratuito. Faça upgrade para remover os limites.
              </p>
            )}

            <button
               onClick={subscribePush}
               className="mt-6 w-full py-2.5 rounded text-[10px] font-bold tracking-widest uppercase transition-all"
               style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Ativar Recebimento de Alertas (Push) Neste Aparelho
            </button>
            <p className="text-[9px] text-slate-500 mt-2 text-center">Permite receber notificações push fora do aplicativo. Requer credencial VAPID real configurada para disparos via webpush no backend.</p>

          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs font-semibold">
            {message}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div className="p-6 rounded-2xl border border-white/10 flex flex-col" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-lg font-bold text-white mb-2">Gratuito</h3>
            <p className="text-2xl font-light text-white mb-6">R$ 0<span className="text-sm text-slate-500">/mês</span></p>
            <ul className="space-y-3 mb-8 flex-1 text-sm text-slate-400">
              <li>• 1 Talhão Ativo</li>
              <li>• Análises Limitadas</li>
              <li>• Chat Básico</li>
            </ul>
            <button disabled className="w-full py-3 rounded-xl bg-white/5 text-slate-500 font-bold cursor-not-allowed">
              Plano Atual
            </button>
          </div>

          <div className="p-6 rounded-2xl border border-primary flex flex-col relative" style={{ background: 'rgba(236,91,19,0.05)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
              Recomendado
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Profissional</h3>
            <p className="text-2xl font-light text-white mb-6">R$ 499<span className="text-sm text-slate-500">/mês</span></p>
            <ul className="space-y-3 mb-8 flex-1 text-sm text-slate-300">
              <li>• Talhões Ilimitados</li>
              <li>• IA Integrada no WhatsApp (Estrutural)</li>
              <li>• Push Notifications em Tempo Real (Estrutural)</li>
              <li>• Alertas Proativos sem Limite</li>
            </ul>
            <button 
              onClick={() => handleCheckout('pro')}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold transition-all hover:opacity-90 disabled:opacity-50"
            >
              Simular Checkout (Pro)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
