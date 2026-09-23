import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NavProvider, useNav } from '@/context/NavContext';
import { TenantProvider, useTenant } from '@/context/TenantContext';
import { useWakeLock } from '@/hooks/useWakeLock';
import { Header } from '@/components/Header';
import { IdentifyScreen } from '@/screens/IdentifyScreen';
import { DestinationScreen } from '@/screens/DestinationScreen';
import { CategoryScreen } from '@/screens/CategoryScreen';
import { TrackingScreen } from '@/screens/TrackingScreen';
import { TenantLoginScreen } from '@/screens/TenantLoginScreen';
import { TenantAdminScreen } from '@/screens/TenantAdminScreen';
import { SuperadminLoginScreen } from '@/screens/SuperadminLoginScreen';
import { SuperadminScreen } from '@/screens/SuperadminScreen';
import { TermsOfService } from '@/screens/TermsOfService';
import { PrivacyPolicy } from '@/screens/PrivacyPolicy';
import { LandingPage } from '@/screens/LandingPage';
import type { GeoPoint } from '@/types';

function PassengerFlow() {
  const { passengerScreen } = useNav();
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [destination, setDestination] = useState<GeoPoint | null>(null);
  const [passengerInfo, setPassengerInfo] = useState<{ name: string; phone: string } | null>(null);

  switch (passengerScreen) {
    case 'identify':
      return <IdentifyScreen onIdentify={setPassengerInfo} />;
    case 'destination':
      return (
        <DestinationScreen
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
        />
      );
    case 'category':
      if (!origin || !destination) return <IdentifyScreen onIdentify={setPassengerInfo} />;
      return <CategoryScreen origin={origin} destination={destination} />;
    case 'tracking':
      if (!origin || !destination || !passengerInfo) return <IdentifyScreen onIdentify={setPassengerInfo} />;
      return (
        <TrackingScreen
          origin={origin}
          destination={destination}
          passengerName={passengerInfo.name}
          passengerPhone={passengerInfo.phone}
        />
      );
    default:
      return <IdentifyScreen onIdentify={setPassengerInfo} />;
  }
}

function AppContent() {
  const { view, tenantSlug, locationSlug } = useNav();
  const { setSlug } = useTenant();
  const { loading, session, isSuperadmin } = useAuth();

  useEffect(() => {
    setSlug(tenantSlug ?? '', locationSlug ?? null);
  }, [tenantSlug, locationSlug, setSlug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  if (view === 'tenant_admin' && !session) {
    return <TenantLoginScreen />;
  }
  if (view === 'superadmin' && !isSuperadmin) {
    return <SuperadminLoginScreen />;
  }

  switch (view) {
    case 'landing':
      return <LandingPage />;
    case 'passenger':
      return <PassengerFlow />;
    case 'tenant_login':
      return <TenantLoginScreen />;
    case 'tenant_admin':
      return <TenantAdminScreen />;
    case 'superadmin_login':
      return <SuperadminLoginScreen />;
    case 'superadmin':
      return <SuperadminScreen />;
    case 'terms':
      return <TermsOfService />;
    case 'privacy':
      return <PrivacyPolicy />;
    default:
      return <PassengerFlow />;
  }
}

function App() {
  useWakeLock();

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavProvider>
          <TenantProvider>
            <AppShell />
          </TenantProvider>
        </NavProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const { view } = useNav();
  const isSuperadminShell = view === 'superadmin' || view === 'superadmin_login';
  const isTenantAdminShell = view === 'tenant_admin' || view === 'tenant_login';

  if (isSuperadminShell || isTenantAdminShell) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <AppContent />
      </div>
    );
  }

  if (view === 'passenger') {
    return (
      <div className="app-shell min-h-screen transition-colors duration-300">
        <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-28 sm:px-6 lg:py-10">
          <section className="min-w-0">
            <AppContent />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen transition-colors duration-300">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-28 sm:px-6 lg:py-10">
        <section className="min-w-0">
          <AppContent />
        </section>
      </main>
      <footer className="border-t border-white/10 bg-black/30 px-5 py-5">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <img src="/veloovrotas.png" alt="Veloov Rotas" className="h-8 w-auto" />
          </div>
          <p className="text-[10px] leading-5 text-slate-500">
            Veloov Negocios e Servicos LTDA · CNPJ 68.559.312/0001-73
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
