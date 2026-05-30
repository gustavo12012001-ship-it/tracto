import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';

const maskPhone = (v: string) => {
  let val = v.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
  } else if (val.length > 6) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  } else if (val.length > 2) {
    return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  } else if (val.length > 0) {
    return `(${val}`;
  }
  return val;
};

// ── Error messages ────────────────────────────────────────────────────────────
function friendlyError(msg: string): string {
  if (msg.includes('User already registered') || msg.includes('already exists')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Telefone inválido.');
      return;
    }
    if (!acceptedTerms) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }

    setLoading(true);

    try {
      // 0. reCAPTCHA Verification (Optional/Harden)
      try {
        const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
        if (window.grecaptcha && siteKey) {
          const token = await window.grecaptcha.execute(siteKey, { action: 'register' });
          await fetch(`${import.meta.env.VITE_API_URL}/api/verify-recaptcha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
        }
      } catch (captchaErr) {
        console.warn('reCAPTCHA error (pular):', captchaErr);
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: cleanPhone,
          },
        },
      });

      if (signUpError) throw new Error(signUpError.message);

      setSuccess(true);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app'
        }
      });
      if (authError) throw new Error(authError.message);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro no login com Google'));
      setGoogleLoading(false);
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
        <div className="relative z-10 w-full max-w-md px-6 py-12">
          <div className="glass-dark-login p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-8">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Criar Nova Conta</p>
            </div>

            {!success && (
              <div className="mb-6 space-y-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full bg-white hover:bg-[#f8f9fa] text-[#3c4043] py-3.5 rounded-xl text-sm font-medium transition-all border border-[#dadce0] flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-70"
                >
                  {googleLoading ? (
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  <span>Continuar com Google</span>
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">ou</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>
              </div>
            )}


            {success ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-green-400 text-2xl">mail</span>
                </div>
                <p className="text-sm font-semibold text-white">Cadastro solicitado</p>
                <p className="text-xs text-slate-400 leading-relaxed">Verifique seu email para confirmar o cadastro.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] shadow-xl shadow-orange-500/20"
                >
                  Ir para Login
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nome Completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="Seu nome"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="••••••••"
                    required
                  />
                </div>


                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* Aceite de termos */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className="w-5 h-5 rounded-md border flex items-center justify-center transition-all"
                      style={{
                        background: acceptedTerms ? '#f97316' : 'rgba(255,255,255,0.05)',
                        borderColor: acceptedTerms ? '#f97316' : 'rgba(255,255,255,0.15)',
                      }}
                    >
                      {acceptedTerms && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-relaxed">
                    Li e aceito os{' '}
                    <Link to="/terms" target="_blank" className="text-orange-400 hover:text-orange-300 underline">
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link to="/privacy" target="_blank" className="text-orange-400 hover:text-orange-300 underline">
                      Política de Privacidade
                    </Link>{' '}
                    da Tracto, incluindo o tratamento dos meus dados pessoais conforme a LGPD.
                  </span>
                </label>

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}

            {!success && (
              <div className="mt-8 text-center">
                <p className="text-slate-500 text-[9px] uppercase tracking-widest">
                  Já possui conta?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-white hover:text-orange-400 transition-colors font-bold ml-2 uppercase"
                  >
                    Fazer Login
                  </button>
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o site
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
