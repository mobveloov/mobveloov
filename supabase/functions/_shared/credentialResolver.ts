// Credential resolver with automatic fallback for edge functions.
// Reads from integration_credentials table ordered by priority.
// Tries each credential until one succeeds, then marks failures.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

export interface ResolvedCredential {
  id: string;
  category: string;
  provider: string;
  credentials: Record<string, string>;
  priority: number;
}

// Fetch all active credentials for a given company + category, ordered by priority.
// Falls back to global credentials (tenant_id IS NULL) if company has none.
export async function getCredentials(
  companyId: string | null,
  category: string,
): Promise<ResolvedCredential[]> {
  let query = admin
    .from("integration_credentials")
    .select("id, category, provider, credentials, priority, tenant_id")
    .eq("category", category)
    .eq("is_active", true)
    .order("priority");

  const { data: companyCreds } = await query.eq("tenant_id", companyId ?? "");

  if (companyCreds && companyCreds.length > 0) {
    return companyCreds as unknown as ResolvedCredential[];
  }

  // Fallback to global credentials
  const { data: globalCreds } = await admin
    .from("integration_credentials")
    .select("id, category, provider, credentials, priority, tenant_id")
    .eq("category", category)
    .eq("is_active", true)
    .is("tenant_id", null)
    .order("priority");

  return (globalCreds ?? []) as unknown as ResolvedCredential[];
}

// Mark a credential as errored (for monitoring/dashboards).
export async function markCredentialError(id: string, message: string): Promise<void> {
  try {
    await admin
      .from("integration_credentials")
      .update({
        last_error_at: new Date().toISOString(),
        last_error_message: message.slice(0, 500),
      })
      .eq("id", id);
  } catch { /* best-effort */ }
}

// Mark a credential as successfully used.
export async function markCredentialUsed(id: string): Promise<void> {
  try {
    await admin
      .from("integration_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", id);
  } catch { /* best-effort */ }
}

// Try each credential in order until one succeeds.
// The `fn` callback receives the credential and should return a result or throw.
// Returns the first successful result, or throws the last error if all fail.
export async function withFallback<T>(
  creds: ResolvedCredential[],
  fn: (cred: ResolvedCredential) => Promise<T>,
): Promise<T> {
  if (creds.length === 0) throw new Error("No active credentials found for this category");
  let lastError: Error | null = null;
  for (const cred of creds) {
    try {
      const result = await fn(cred);
      await markCredentialUsed(cred.id);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await markCredentialError(cred.id, lastError.message);
      // Continue to next credential
    }
  }
  throw lastError ?? new Error("All credentials failed");
}
