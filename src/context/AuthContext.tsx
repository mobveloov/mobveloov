import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfig } from '@/lib/supabase';
import type { Company, CompanyAdmin } from '@/types';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  isSuperadmin: boolean;
  company: Company | null;
  companyAdmin: CompanyAdmin | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyAdmin, setCompanyAdmin] = useState<CompanyAdmin | null>(null);

  const loadUserData = async (uid: string, roleFromJwt?: string) => {
    if (roleFromJwt === 'superadmin') {
      setIsSuperadmin(true);
      setCompany(null);
      setCompanyAdmin(null);
      return;
    }

    const { data: adminRecord } = await supabase
      .from('company_admins')
      .select('*, companies(*)')
      .eq('user_id', uid)
      .maybeSingle();

    if (adminRecord) {
      setCompanyAdmin(adminRecord as CompanyAdmin);
      setCompany((adminRecord as { companies: Company }).companies);
      setIsSuperadmin(false);
    } else {
      setCompany(null);
      setCompanyAdmin(null);
      setIsSuperadmin(false);
    }
  };

  useEffect(() => {
    if (!supabaseConfig.isConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        const role = (s.user.app_metadata as { role?: string })?.role;
        loadUserData(s.user.id, role);
      }
      setLoading(false);
    }).catch(() => {
      setSession(null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        const role = (s.user.app_metadata as { role?: string })?.role;
        loadUserData(s.user.id, role);
      } else {
        setIsSuperadmin(false);
        setCompany(null);
        setCompanyAdmin(null);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsSuperadmin(false);
    setCompany(null);
    setCompanyAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, isSuperadmin, company, companyAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
