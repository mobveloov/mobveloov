/*
# Create integration_credentials table for multi-provider plug-and-play integrations

1. Purpose
   - Stores multiple API credentials per company per integration category, ordered by priority.
   - When a provider call fails (rate limit, key blocked, timeout), the system automatically
     tries the next credential in the same category (fallback chain).
   - Supports up to N credentials per provider per company (e.g. 10 Groq keys).
   - Company-level credentials (tenant_id = company UUID) and global credentials
     (tenant_id = NULL, managed by SuperAdmin).

2. New Table: integration_credentials
   - id (uuid, PK)
   - tenant_id (uuid, FK to companies, nullable — NULL = global/superadmin-managed)
   - category (text, NOT NULL) — one of: 'maps', 'dispatch', 'payments', 'messaging',
     'push', 'compliance', 'fiscal'
   - provider (text, NOT NULL) — e.g. 'google_maps', 'mapbox', 'here', 'osrm',
     'machine', 'stripe', 'asaas', 'pagar_me', 'mercado_pago', 'pagseguro',
     'evolution', 'meta_cloud', 'twilio', 'zenvia', 'groq', 'openai',
     'fcm', 'onesignal', 'serpro', 'infosimples', 'focus_nfe', 'enotas'
   - label (text) — user-friendly name for this credential set (e.g. "Groq Key 1")
   - credentials (JSONB, NOT NULL) — key-value pairs of API keys, tokens, URLs
   - priority (integer, NOT NULL DEFAULT 0) — lower = higher priority (0 = primary)
   - is_active (boolean, DEFAULT true)
   - last_used_at (timestamptz, nullable)
   - last_error_at (timestamptz, nullable)
   - last_error_message (text, nullable)
   - created_at (timestamptz)
   - updated_at (timestamptz)

3. Indexes
   - (tenant_id, category, priority) for fast fallback lookups
   - (tenant_id, category, provider) for deduplication

4. Security
   - RLS enabled
   - Superadmin can read/write all rows (including tenant_id = NULL)
   - Company admins can read/write only their own company's rows
   - anon has NO access — credentials never exposed to the browser
   - The service role (edge functions) bypasses RLS entirely
*/

CREATE TABLE IF NOT EXISTS integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  category text NOT NULL,
  provider text NOT NULL,
  label text NOT NULL DEFAULT '',
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_cred_tenant_cat_pri
  ON integration_credentials (tenant_id, category, priority);
CREATE INDEX IF NOT EXISTS idx_integration_cred_tenant_cat_prov
  ON integration_credentials (tenant_id, category, provider);

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_integration_credentials" ON integration_credentials;
CREATE POLICY "select_integration_credentials" ON integration_credentials FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = integration_credentials.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "insert_integration_credentials" ON integration_credentials;
CREATE POLICY "insert_integration_credentials" ON integration_credentials FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = integration_credentials.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "update_integration_credentials" ON integration_credentials;
CREATE POLICY "update_integration_credentials" ON integration_credentials FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = integration_credentials.tenant_id
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = integration_credentials.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "delete_integration_credentials" ON integration_credentials;
CREATE POLICY "delete_integration_credentials" ON integration_credentials FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = integration_credentials.tenant_id
      )
    )
  );

-- Also create a view that masks credential values for safe frontend display.
-- Returns everything except the actual secret values — shows only which keys are configured.
CREATE OR REPLACE VIEW integration_credentials_safe AS
SELECT
  id,
  tenant_id,
  category,
  provider,
  label,
  (
    SELECT jsonb_object_agg(key, CASE
      WHEN value IS NULL OR value::text = '' THEN 'not_set'
      ELSE 'configured'
    END)
    FROM jsonb_each_text(credentials) AS e(key, value)
  ) AS credential_fields,
  priority,
  is_active,
  last_used_at,
  last_error_at,
  last_error_message,
  created_at,
  updated_at
FROM integration_credentials;

ALTER VIEW integration_credentials_safe OWNER TO postgres;
GRANT SELECT ON integration_credentials_safe TO authenticated;