import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verifica se estamos em um fluxo de reset (veio pelo link do email)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Se nÃ£o tiver sessÃ£o ativa (vinda do link de reset), redireciona
        console.warn('Nenhuma sessÃ£o de recuperaÃ§Ã£o encontrada.');
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas nÃ£o coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.updateUser({
        password: password
      });

      if (resetError) throw resetError;

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md glass-dark p-8 rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Redefinir Senha</p>
        </div>

        {success ? (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-green-400 text-2xl">check_circle</span>
            </div>
            <p className="text-sm font-semibold text-white">Senha alterada com sucesso!</p>
            <p className="text-xs text-slate-400">Você será redirecionado em instantes...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nova Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Nova Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Redefinir Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
