import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, supabaseConfig } from '@/lib/supabase';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import type { Company, CompanySettings, VehicleCategory, CompanyLocation } from '@/types';

interface TenantContextValue {
  company: Company | null;
  settings: CompanySettings | null;
  categories: VehicleCategory[];
  location: CompanyLocation | null;
  locations: CompanyLocation[];
  loading: boolean;
  error: string | null;
  deviceLocked: boolean;
  licenseExpired: boolean;
  setSlug: (slug: string, locationSlug?: string | null) => void;
  slug: string | null;
  locationSlug: string | null;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [slug, setSlugState] = useState<string | null>(null);
  const [locationSlug, setLocationSlugState] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [location, setLocation] = useState<CompanyLocation | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [licenseExpired, setLicenseExpired] = useState(false);

  const setSlug = (s: string, locSlug?: string | null) => {
    setSlugState(s);
    setLocationSlugState(locSlug ?? null);
  };

  useEffect(() => {
    if (!slug) {
      setCompany(null);
      setSettings(null);
      setCategories([]);
      setLocation(null);
      setLocations([]);
      setLicenseExpired(false);
      return;
    }

    if (!supabaseConfig.isConfigured) {
      setError('Supabase nao configurado');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      const { data: comp, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();

      if (compErr || !comp) {
        setError('Empresa não encontrada ou inativa');
        setCompany(null);
        setSettings(null);
        setCategories([]);
        setLocation(null);
        setLocations([]);
        setLoading(false);
        return;
      }

      setCompany(comp as Company);

      // License expiration check
      const expiresAt = (comp as Company).expires_at;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        setLicenseExpired(true);
        setLoading(false);
        return;
      }
      setLicenseExpired(false);

      // Load all locations for this company
      const { data: locs } = await supabase
        .from('company_locations')
        .select('*')
        .eq('company_id', comp.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const allLocations = (locs ?? []) as CompanyLocation[];
      setLocations(allLocations);

      // If a location slug is specified, find it
      let activeLocation: CompanyLocation | null = null;
      if (locationSlug) {
        activeLocation = allLocations.find((l) => l.slug === locationSlug) ?? null;
        if (!activeLocation) {
          setError('Local não encontrado');
          setLocation(null);
          setCategories([]);
          setLoading(false);
          return;
        }
      }
      setLocation(activeLocation);

      // Device fingerprint hard-lock enforcement
      if (activeLocation) {
        const fingerprint = getDeviceFingerprint();
        const storedFp = activeLocation.device_fingerprint;

        if (!storedFp) {
          // First time this totem is opened — bind the fingerprint
          await supabase
            .from('company_locations')
            .update({ device_fingerprint: fingerprint, updated_at: new Date().toISOString() })
            .eq('id', activeLocation.id);
          await supabase.from('admin_logs').insert({
            company_id: comp.id,
            source: 'device_binding',
            level: 'info',
            message: `Totem "${activeLocation.name}" vinculado ao dispositivo ${fingerprint.slice(0, 16)}...`,
            payload: { location_id: activeLocation.id, location_slug: activeLocation.slug, fingerprint },
          });
          setDeviceLocked(false);
        } else if (storedFp !== fingerprint) {
          // Fingerprint mismatch — freeze the screen
          setDeviceLocked(true);
          await supabase.from('admin_logs').insert({
            company_id: comp.id,
            source: 'device_binding',
            level: 'warn',
            message: `Acesso negado ao totem "${activeLocation.name}": fingerprint diferente detectada`,
            payload: { location_id: activeLocation.id, stored_fingerprint: storedFp, detected_fingerprint: fingerprint },
          });
          setLoading(false);
          return;
        } else {
          setDeviceLocked(false);
        }
      } else {
        setDeviceLocked(false);
      }

      const { data: sett } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', comp.id)
        .maybeSingle();

      if (sett) setSettings(sett as CompanySettings);

      // Load categories for the active location only (location_id is NOT NULL after migration)
      let catQuery = supabase
        .from('vehicle_categories')
        .select('*')
        .eq('company_id', comp.id)
        .eq('is_active', true);

      if (activeLocation) {
        catQuery = catQuery.eq('location_id', activeLocation.id);
      }

      const { data: cats } = await catQuery.order('sort_order', { ascending: true });

      setCategories((cats ?? []) as VehicleCategory[]);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, locationSlug]);

  // Periodic re-check: detect if admin cleared the device binding while this totem is running
  useEffect(() => {
    if (!slug || !locationSlug || deviceLocked) return;
    const interval = setInterval(async () => {
      const { data: loc } = await supabase
        .from('company_locations')
        .select('device_fingerprint')
        .eq('slug', locationSlug)
        .eq('company_id', company?.id ?? '')
        .maybeSingle();
      if (!loc) return;
      const fingerprint = getDeviceFingerprint();
      if (loc.device_fingerprint && loc.device_fingerprint !== fingerprint) {
        setDeviceLocked(true);
      } else if (!loc.device_fingerprint) {
        setDeviceLocked(false);
      }
    }, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, locationSlug, deviceLocked, company]);

  return (
    <TenantContext.Provider value={{ company, settings, categories, location, locations, loading, error, deviceLocked, licenseExpired, setSlug, slug, locationSlug }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
