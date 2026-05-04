import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Session } from '@supabase/supabase-js';

// Função para aplicar a máscara visual de telefone brasileiro que você já usa no Register.tsx
const maskPhone = (v: string) => {
  let val = v.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
  if (val.length > 6) return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  if (val.length > 2) return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  if (val.length > 0) return `(${val}`;
  return val;
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Verificar sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      
      setSession(data.session);
      
      const userPhone = data.session?.user?.user_metadata?.phone;
      if (data.session && !userPhone) {
        setNeedsPhone(true);
      } else {
        setNeedsPhone(false);
      }
    });

    // 2. Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      const userPhone = session?.user?.user_metadata?.phone;
      if (session && !userPhone) {
        setNeedsPhone(true);
      } else {
        setNeedsPhone(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Função para salvar o telefone no perfil do Supabase quando o usuário digita
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Por favor, insira um número de WhatsApp válido.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { phone: cleanPhone }
      });

      if (error) throw error;
      
      setNeedsPhone(false);
    } catch (err: unknown) {
      console.error('ProtectedRoute Error:', err);
      alert('Erro ao salvar o telefone. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="flex flex-col items-center gap-4">
          <span className="inline-block w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(236,91,19,0.3)', borderTopColor: '#ec5b13' }} />
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se a sessão existe mas o telefone está em falta, interceptamos e mostramos a tela de bloqueio
  if (needsPhone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 z-[9999] relative" style={{ background: '#080809' }}>
        <div className="w-full max-w-md p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl relative z-10" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="text-center mb-8">
            <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
            <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Quase lá! Precisamos do seu contato</p>
          </div>

          <form onSubmit={handleSavePhone} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">WhatsApp para Alertas</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                placeholder="(11) 99999-9999"
                required
              />
              <p className="text-[10px] text-slate-500 ml-1">Usaremos este número apenas para enviar alertas críticos de clima e satélite da sua lavoura.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? 'Salvando...' : 'Concluir Acesso'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
