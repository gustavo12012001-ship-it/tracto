import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { supabase } from '../services/supabase';

// ── Geolocation helper ────────────────────────────────────────────────────────
async function fetchLocation(): Promise<{ lat: number; lng: number; name: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: -23.31028, lng: -51.16278, name: 'Londrina, PR' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            'Localização Atual';
          resolve({ lat, lng: lon, name: `${city}, ${data.address?.state_code?.toUpperCase() ?? ''}` });
        } catch {
          resolve({ lat, lng: lon, name: 'Localização Atual' });
        }
      },
      () => resolve({ lat: -23.31028, lng: -51.16278, name: 'Londrina, PR' })
    );
  });
}

// ── Error messages ────────────────────────────────────────────────────────────
function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User not found')) return 'Usuário não encontrado.';
  if (msg.includes('Invalid email')) return 'E-mail inválido.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const { setLocation } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);

    // Bypass provisório para desenvolvimento/adm:
    if (email === 'admin' || email === 'admin@tracto.com.br') {
      const loc = await fetchLocation();
      setLocation(loc);
      navigate('/app');
      return;
    }

    try {
      // 1. Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);

      // 2. Geolocation (non-blocking — runs after auth OK)
      const loc = await fetchLocation();
      setLocation(loc);

      navigate('/app');
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .login-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-dark-login {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
      `}</style>

      <div className="login-body relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aérea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass-dark-login p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-10">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Acesso ao Ecossistema</p>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
                  <a className="text-[9px] uppercase tracking-widest text-orange-400 hover:text-orange-300 transition-colors" href="#">Esqueceu?</a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              {/* Autocomplete para testes locais */}
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => { setEmail('admin@tracto.com.br'); setPassword('123456'); }}
                  className="text-[9px] text-green-400 uppercase tracking-wider font-bold hover:text-green-300 transition-colors"
                >
                  [Autopreencher ADM]
                </button>
              </div>

              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="material-symbols-outlined text-sm text-red-400">error</span>
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                      Entrando...
                    </>
                  ) : 'Entrar'}
                </button>
              </div>
            </form>

            <div className="mt-10 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">
                Ainda não possui acesso?{' '}
                <button onClick={() => navigate('/register')} className="text-white hover:text-orange-400 transition-colors font-bold ml-2 uppercase">Solicitar Credenciais</button>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <a
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o site
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
