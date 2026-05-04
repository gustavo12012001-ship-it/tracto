import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

type Stage = 'loading' | 'form' | 'success' | 'invalid';

function friendlyError(msg: string): string {
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('same password')) return 'A nova senha não pode ser igual à atual.';
  if (msg.includes('expired')) return 'Link expirado. Solicite um novo e-mail de recuperação.';
  return 'Erro ao atualizar senha. Tente novamente.';
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStage('form');
      }
    });

    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setStage('form');
    } else {
      const timer = setTimeout(() => {
        setStage((s) => s === 'loading' ? 'invalid' : s);
      }, 2000);
      return () => {
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setStage('success');
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
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aérea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass-dark-login p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="text-center mb-10">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Redefinição de Senha</p>
            </div>

            {stage === 'loading' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="inline-block w-10 h-10 rounded-full border-4 border-orange-400 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm">Validando link de recuperação...</p>
              </div>
            )}

            {stage === 'invalid' && (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="material-symbols-outlined text-red-400 text-3xl">link_off</span>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium mb-2">Link inválido ou expirado</p>
                  <p className="text-slate-400 text-sm">Solicite um novo e-mail de recuperação na tela de login.</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95"
                >
                  Ir para o Login
                </button>
              </div>
            )}

            {stage === 'form' && (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <p className="text-slate-400 text-sm text-center -mt-4 mb-2">
                  Escolha uma nova senha para sua conta.
                </p>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light pr-12"
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showPass ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Senha</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    required
                  />
                </div>

                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map((n) => (
                        <div key={n} className="h-1 flex-1 rounded-full transition-all" style={{
                          background: password.length >= n * 3
                            ? n <= 1 ? '#ef4444' : n <= 2 ? '#f97316' : n <= 3 ? '#eab308' : '#22c55e'
                            : 'rgba(255,255,255,0.1)'
                        }} />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-1">
                      {password.length < 4 ? 'Muito fraca' : password.length < 7 ? 'Fraca' : password.length < 10 ? 'Razoável' : 'Forte'}
                    </p>
                  </div>
                )}

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
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Salvando...
                      </>
                    ) : 'Redefinir Senha'}
                  </button>
                </div>
              </form>
            )}

            {stage === 'success' && (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium mb-2">Senha atualizada!</p>
                  <p className="text-slate-400 text-sm">Sua senha foi redefinida com sucesso. Faça login com a nova senha.</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95"
                >
                  Ir para o Login
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/login')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
