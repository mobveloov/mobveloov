import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const rawSupabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const isValidSupabaseUrl = /^https:\/\/[^\s/]+(?:\/.*)?$/i.test(rawSupabaseUrl);

export const supabaseConfig = {
  isConfigured: isValidSupabaseUrl && rawSupabaseAnonKey.length > 0,
  error: !isValidSupabaseUrl
    ? 'VITE_SUPABASE_URL ausente ou invalida no build.'
    : rawSupabaseAnonKey.length === 0
      ? 'VITE_SUPABASE_ANON_KEY ausente no build.'
      : null,
};

export const supabase = createClient(
  isValidSupabaseUrl ? rawSupabaseUrl : 'https://missing-supabase-config.invalid',
  rawSupabaseAnonKey || 'missing-supabase-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);
