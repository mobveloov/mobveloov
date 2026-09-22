import { Building2, LogOut } from 'lucide-react';
import { useNav } from '@/context/NavContext';

export function Header() {
  const { view, navigate } = useNav();

  const showAdminButton = view === 'landing';
  const showExitButton = view === 'tenant_admin' || view === 'superadmin';

  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-3.5">
        <button
          onClick={() => navigate('passenger')}
          className="flex items-center gap-2"
        >
          <img src="/veloovrotas.png" alt="Veloov Rotas" className="h-10 w-auto" />
        </button>

        <div className="flex items-center gap-2">
          {showAdminButton && (
            <button
              onClick={() => navigate('tenant_login')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-gold-500/40 hover:text-gold-300"
              aria-label="Painel da empresa"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Entrar</span>
            </button>
          )}

          {showExitButton && (
            <button
              onClick={() => navigate('passenger')}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-error-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-error-500/10"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
    >
      <span>←</span>
      {label}
    </button>
  );
}
