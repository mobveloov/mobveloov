import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Building2, Smartphone, CreditCard, Settings2,
  Car, Users, MessageCircle, Shield, FileText, ScrollText, LifeBuoy,
  LogOut, Crown, X, Moon, Sun, UserCircle, ChevronDown, Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNav } from '@/context/NavContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, ToastContainer, useToast } from './shared';
import { NotificationBell } from './modules/Notifications';
import { ProfileModule } from './modules/Profile';
import { DashboardModule } from './modules/Dashboard';
import { CompaniesModule } from './modules/Companies';
import { TotemsModule } from './modules/Totems';
import { PlansModule } from './modules/Plans';
import { BillingModule } from './modules/Billing';
import { IntegrationsModule } from './modules/Integrations';
import { AdvancedIntegrationsModule } from './modules/AdvancedIntegrations';
import { DriversModule } from './modules/Drivers';
import { PassengersModule } from './modules/Passengers';
import { RidesModule } from './modules/Rides';
import { UsersModule } from './modules/Users';
import { ReportsModule } from './modules/Reports';
import { AuditModule } from './modules/Audit';
import { TicketsModule } from './modules/Tickets';

export type ModuleKey =
  | 'dashboard' | 'companies' | 'totems' | 'plans' | 'billing'
  | 'integrations' | 'advanced_integrations' | 'drivers' | 'passengers' | 'rides'
  | 'users' | 'reports' | 'audit' | 'tickets' | 'profile';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Visão Geral' },
  { key: 'companies', label: 'Empresas', icon: <Building2 className="h-4 w-4" />, group: 'Gestão' },
  { key: 'totems', label: 'Totens', icon: <Smartphone className="h-4 w-4" />, group: 'Gestão' },
  { key: 'plans', label: 'Planos', icon: <CreditCard className="h-4 w-4" />, group: 'Gestão' },
  { key: 'billing', label: 'Faturamento', icon: <CreditCard className="h-4 w-4" />, group: 'Gestão' },
  { key: 'drivers', label: 'Motoristas', icon: <Car className="h-4 w-4" />, group: 'Operação' },
  { key: 'passengers', label: 'Passageiros', icon: <Users className="h-4 w-4" />, group: 'Operação' },
  { key: 'rides', label: 'Corridas', icon: <MessageCircle className="h-4 w-4" />, group: 'Operação' },
  { key: 'integrations', label: 'Integrações', icon: <Settings2 className="h-4 w-4" />, group: 'Sistema' },
  { key: 'advanced_integrations', label: 'Integrações Avançadas', icon: <Zap className="h-4 w-4" />, group: 'Sistema' },
  { key: 'users', label: 'Usuários Internos', icon: <Shield className="h-4 w-4" />, group: 'Sistema' },
  { key: 'reports', label: 'Relatórios', icon: <FileText className="h-4 w-4" />, group: 'Sistema' },
  { key: 'audit', label: 'Auditoria', icon: <ScrollText className="h-4 w-4" />, group: 'Sistema' },
  { key: 'tickets', label: 'Suporte', icon: <LifeBuoy className="h-4 w-4" />, group: 'Sistema' },
];

const SIDEBAR_GROUPS = ['Visão Geral', 'Gestão', 'Operação', 'Sistema'];

export function SuperadminLayout() {
  const { signOut, isSuperadmin, session } = useAuth();
  const { navigate } = useNav();
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState<ModuleKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState('SA');
  const { toasts, success, error } = useToast();
  const avatarRef = useRef<HTMLDivElement>(null);

  const logAction = useCallback(async (action: string, targetType?: string, targetId?: string, targetName?: string) => {
    try {
      await supabase.from('audit_logs').insert({
        actor_id: session?.user?.id ?? null,
        actor_email: session?.user?.email ?? null,
        action,
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        target_name: targetName ?? null,
      });
    } catch { /* non-critical */ }
  }, [session]);

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('internal_users')
        .select('name, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        setAvatarUrl(data.avatar_url);
        setUserInitials((data.name ?? 'SA').slice(0, 2).toUpperCase());
      }
    })();
  }, [session]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!isSuperadmin) return null;

  const handleSignOut = () => {
    signOut();
    navigate('superadmin_login');
  };

  const renderModule = () => {
    const props = { success, error, logAction, globalSearch };
    switch (active) {
      case 'dashboard': return <DashboardModule {...props} />;
      case 'companies': return <CompaniesModule {...props} />;
      case 'totems': return <TotemsModule {...props} />;
      case 'plans': return <PlansModule {...props} />;
      case 'billing': return <BillingModule {...props} />;
      case 'integrations': return <IntegrationsModule {...props} />;
      case 'advanced_integrations': return <AdvancedIntegrationsModule {...props} />;
      case 'drivers': return <DriversModule {...props} />;
      case 'passengers': return <PassengersModule {...props} />;
      case 'rides': return <RidesModule {...props} />;
      case 'users': return <UsersModule {...props} />;
      case 'reports': return <ReportsModule {...props} />;
      case 'audit': return <AuditModule {...props} />;
      case 'tickets': return <TicketsModule {...props} />;
      case 'profile': return <ProfileModule success={success} error={error} />;
      default: return <DashboardModule {...props} />;
    }
  };

  const activeLabel = active === 'profile'
    ? 'Meu Perfil'
    : NAV_ITEMS.find((n) => n.key === active)?.label ?? '';

  const headerRight = (
    <>
      <NotificationBell onNavigate={(dest) => setActive(dest)} />
      <div className="relative" ref={avatarRef}>
        <button
          onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
          className="flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-black text-[#D4AF37]">{userInitials}</span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-white transition-colors" />
        </button>

        {avatarMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs font-bold text-white truncate">{session?.user?.email ?? 'superadmin'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Conta SuperAdmin</p>
            </div>
            <div className="py-1.5">
              <button
                onClick={() => { setActive('profile'); setAvatarMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <UserCircle className="h-4 w-4" />
                Meu Perfil
              </button>
              <button
                onClick={() => { toggleTheme(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {theme === 'light' ? 'Tema Escuro' : 'Tema Claro'}
              </button>
            </div>
            <div className="py-1.5 border-t border-slate-800">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <ToastContainer toasts={toasts} />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-slate-900 border-r border-slate-800 z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="p-2 bg-amber-500/10 rounded-xl text-[#D4AF37] border border-[#D4AF37]/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight">Veloov SaaS</h1>
            <p className="text-[10px] text-slate-500">Console SuperAdmin</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group}>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-3 mb-2">{group}</p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setActive(item.key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      active === item.key
                        ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800 space-y-1.5">
          <button
            onClick={() => { setActive('profile'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              active === 'profile'
                ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <UserCircle className="h-4 w-4" />
            Meu Perfil
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <main className="flex-1 p-6 overflow-y-auto">
          <PageHeader
            title={activeLabel}
            searchValue={globalSearch}
            onSearchChange={setGlobalSearch}
            onMenuClick={() => setSidebarOpen(true)}
            rightSlot={headerRight}
          />
          {renderModule()}
        </main>
      </div>
    </div>
  );
}

export interface ModuleProps {
  success: (msg: string) => void;
  error: (msg: string) => void;
  logAction: (action: string, targetType?: string, targetId?: string, targetName?: string) => Promise<void>;
  globalSearch: string;
}
