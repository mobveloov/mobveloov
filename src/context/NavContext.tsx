import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type AppView = 'landing' | 'passenger' | 'tenant_login' | 'tenant_admin' | 'superadmin_login' | 'superadmin' | 'terms' | 'privacy';
type PassengerScreen = 'identify' | 'destination' | 'category' | 'tracking';
type AdminScreen = 'dashboard' | 'locations' | 'integration' | 'pricing' | 'dispatch' | 'drivers' | 'rides' | 'whatsapp' | 'chats' | 'manual' | 'settings' | 'users' | 'notifications' | 'audit' | 'reports' | 'finance' | 'subscription';

interface NavContextValue {
  view: AppView;
  tenantSlug: string | null;
  locationSlug: string | null;
  passengerScreen: PassengerScreen;
  adminScreen: AdminScreen;
  selectedCategoryId: string | null;
  selectedCategoryPrice: number | null;
  machineDistance: number | null;
  machineDuration: number | null;
  setTenantSlug: (slug: string, locationSlug?: string) => void;
  navigate: (view: AppView) => void;
  goPassenger: (screen: PassengerScreen) => void;
  goAdmin: (screen: AdminScreen) => void;
  selectCategory: (id: string, distance?: number | null, duration?: number | null, price?: number | null) => void;
}

const NavContext = createContext<NavContextValue | undefined>(undefined);

const RESERVED_SLUGS = new Set(['admin', 'superadmin', 'terms-of-service', 'privacy-policy']);

function parseUrl(): { view: AppView; tenantSlug: string | null; locationSlug: string | null; adminScreen: AdminScreen } {
  const path = window.location.pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return { view: 'landing', tenantSlug: null, locationSlug: null, adminScreen: 'dashboard' };

  if (segments[0] === 'admin') return { view: 'tenant_admin', tenantSlug: null, locationSlug: null, adminScreen: 'dashboard' };
  if (segments[0] === 'superadmin') return { view: 'superadmin', tenantSlug: null, locationSlug: null, adminScreen: 'dashboard' };
  if (segments[0] === 'terms-of-service') return { view: 'terms', tenantSlug: null, locationSlug: null, adminScreen: 'dashboard' };
  if (segments[0] === 'privacy-policy') return { view: 'privacy', tenantSlug: null, locationSlug: null, adminScreen: 'dashboard' };

  // /company/:slug[/admin] — legacy format, still supported
  if (segments[0] === 'company' && segments.length >= 2) {
    const slug = segments[1];
    if (segments[2] === 'admin') return { view: 'tenant_admin', tenantSlug: slug, locationSlug: null, adminScreen: 'dashboard' };
    return { view: 'passenger', tenantSlug: slug, locationSlug: null, adminScreen: 'dashboard' };
  }

  // /:companySlug/:locationSlug — passenger kiosk at a specific location
  // /:companySlug — passenger kiosk (no specific location, or admin)
  if (!RESERVED_SLUGS.has(segments[0])) {
    const companySlug = segments[0];
    if (segments.length >= 2 && segments[1] === 'admin') {
      return { view: 'tenant_admin', tenantSlug: companySlug, locationSlug: null, adminScreen: 'dashboard' };
    }
    if (segments.length >= 2) {
      return { view: 'passenger', tenantSlug: companySlug, locationSlug: segments[1], adminScreen: 'dashboard' };
    }
    return { view: 'passenger', tenantSlug: companySlug, locationSlug: null, adminScreen: 'dashboard' };
  }

  return { view: 'passenger', tenantSlug: null, locationSlug: null, adminScreen: 'dashboard' };
}

function buildUrl(view: AppView, tenantSlug: string | null, locationSlug: string | null = null): string {
  switch (view) {
    case 'tenant_login':
    case 'tenant_admin':
      return '/admin';
    case 'superadmin_login':
    case 'superadmin':
      return '/superadmin';
    case 'terms':
      return '/terms-of-service';
    case 'privacy':
      return '/privacy-policy';
    case 'landing':
    case 'passenger':
      if (!tenantSlug) return '/';
      return locationSlug ? `/${tenantSlug}/${locationSlug}` : `/${tenantSlug}`;
    default:
      return '/';
  }
}

export function NavProvider({ children }: { children: ReactNode }) {
  const initial = parseUrl();
  const [view, setView] = useState<AppView>(initial.view);
  const [tenantSlug, setTenantSlugState] = useState<string | null>(initial.tenantSlug);
  const [locationSlug, setLocationSlugState] = useState<string | null>(initial.locationSlug);
  const [passengerScreen, setPassengerScreen] = useState<PassengerScreen>('identify');
  const [adminScreen, setAdminScreen] = useState<AdminScreen>(initial.adminScreen);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryPrice, setSelectedCategoryPrice] = useState<number | null>(null);
  const [machineDistance, setMachineDistance] = useState<number | null>(null);
  const [machineDuration, setMachineDuration] = useState<number | null>(null);

  useEffect(() => {
    const onPop = () => {
      const parsed = parseUrl();
      setView(parsed.view);
      setTenantSlugState(parsed.tenantSlug);
      setLocationSlugState(parsed.locationSlug);
      setAdminScreen(parsed.adminScreen);
      setPassengerScreen('identify');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const pushUrl = (v: AppView, slug: string | null = tenantSlug, locSlug: string | null = locationSlug) => {
    const url = buildUrl(v, slug, locSlug);
    if (window.location.pathname !== url) {
      window.history.pushState({}, '', url);
    }
  };

  const navigate = (v: AppView) => {
    setView(v);
    pushUrl(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setTenantSlug = (slug: string, locSlug?: string) => {
    setTenantSlugState(slug);
    setLocationSlugState(locSlug ?? null);
    setPassengerScreen('identify');
    pushUrl('passenger', slug, locSlug ?? null);
  };

  const goPassenger = (s: PassengerScreen) => {
    setPassengerScreen(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goAdmin = (s: AdminScreen) => {
    setAdminScreen(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectCategory = (id: string, distance?: number | null, duration?: number | null, price?: number | null) => {
    setSelectedCategoryId(id);
    setMachineDistance(distance ?? null);
    setMachineDuration(duration ?? null);
    setSelectedCategoryPrice(price ?? null);
  };

  return (
    <NavContext.Provider
      value={{
        view,
        tenantSlug,
        locationSlug,
        passengerScreen,
        adminScreen,
        selectedCategoryId,
        selectedCategoryPrice,
        machineDistance,
        machineDuration,
        setTenantSlug,
        navigate,
        goPassenger,
        goAdmin,
        selectCategory,
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}

export type { AppView, PassengerScreen, AdminScreen };
