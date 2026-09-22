import { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNav } from '@/context/NavContext';

export function TenantLoginScreen() {
  const { signIn } = useAuth();
  const { navigate } = useNav();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      setLoading(false);
      return;
    }

    navigate('tenant_admin');
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/40 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/15">
            <Building2 className="h-8 w-8 text-gold-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Painel da empresa</h1>
          <p className="mt-2 text-sm text-slate-400">Acesse o painel administrativo da sua empresa</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-slate-600 bg-slate-800/60 py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500/40"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                placeholder="Sua senha"
                className="w-full rounded-xl border border-slate-600 bg-slate-800/60 py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500/40"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3.5 text-base font-semibold text-neutral-900 shadow-lg shadow-gold-500/20 transition-all hover:bg-gold-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
            {!loading && <ArrowRight className="h-5 w-5" />}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4" />
          <span>Acesso restrito a administradores cadastrados</span>
        </div>

        <button
          onClick={() => navigate('superadmin_login')}
          className="mt-4 w-full text-center text-xs text-slate-400 transition-colors hover:text-gold-400"
        >
          Acesso SuperAdmin (dono da plataforma)
        </button>
      </div>
    </div>
  );
}
