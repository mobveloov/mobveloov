import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, MapPin, Plug, DollarSign, Radio, Users, Car,
  MessageCircle, BookOpen, Settings, UserCog, Bell, ScrollText,
  BarChart3, Wallet, LogOut, Menu, X, ChevronRight, Crown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNav, type AdminScreen } from '@/context/NavContext';

interface NavItem {
  key: AdminScreen;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, group: 'Operação' },
  { key: 'dispatch', label: 'Dispatch', icon: Radio, group: 'Operação' },
  { key: 'rides', label: 'Corridas', icon: Car, group: 'Operação' },
  { key: 'drivers', label: 'Motoristas', icon: Users, group: 'Operação' },
  { key: 'locations', label: 'Totens & Locais', icon: MapPin, group: 'Operação' },
  { key: 'pricing', label: 'Preços', icon: DollarSign, group: 'Configuração' },
  { key: 'integration', label: 'Integração', icon: Plug, group: 'Configuração' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, group: 'Configuração' },
  { key: 'settings', label: 'Dados da Empresa', icon: Settings, group: 'Configuração' },
  { key: 'subscription', label: 'Assinatura', icon: Crown, group: 'Configuração' },
  { key: 'users', label: 'Usuários & Permissões', icon: UserCog, group: 'Gestão' },
  { key: 'finance', label: 'Financeiro', icon: Wallet, group: 'Gestão' },
  { key: 'reports', label: 'Relatórios', icon: BarChart3, group: 'Gestão' },
  { key: 'notifications', label: 'Notificações', icon: Bell, group: 'Gestão' },
  { key: 'audit', label: 'Auditoria', icon: ScrollText, group: 'Gestão' },
  { key: 'manual', label: 'Manual', icon: BookOpen, group: 'Ajuda' },
];

const GROUP_ORDER = ['Operação', 'Configuração', 'Gestão', 'Ajuda'];

export function AdminLayout({ children, modeLabel }: { children: ReactNode; modeLabel: string }) {
  const { company, signOut } = useAuth();
  const { adminScreen, goAdmin, navigate } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (key: AdminScreen) => {
    goAdmin(key);
    setMobileOpen(false);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 ring-1 ring-gold-500/30">
          <span className="text-lg font-extrabold text-gold-400">V</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-100">{company?.name ?? 'Empresa'}</p>
          <p className="text-xs text-slate-500">Painel Administrativo</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUP_ORDER.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-5">
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">{group}</p>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = adminScreen === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNav(item.key)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/25'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {active && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-gold-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-800/40 px-3 py-2">
          <span className={`h-2 w-2 rounded-full ${modeLabel === 'Manual' ? 'bg-slate-500' : 'bg-success-500'} animate-pulse`} />
          <span className="text-xs font-semibold text-slate-400">Modo: {modeLabel}</span>
        </div>
        <button
          onClick={() => { signOut(); navigate('tenant_login'); }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-error-500/10 hover:text-error-400"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex w-72 flex-col border-r border-slate-800 bg-slate-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
            <span className="text-sm font-extrabold text-gold-400">V</span>
          </div>
          <p className="truncate text-sm font-bold text-slate-100">{company?.name ?? 'Painel'}</p>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-24">
            {children}
          </div>
        </main>

        <footer className="sticky bottom-0 border-t border-slate-800/50 bg-slate-950/80 px-5 py-2.5 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
            <span>Veloov Mobilidade</span>
            <span>·</span>
            <span>Powered by Bolt</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export type { AdminScreen };
