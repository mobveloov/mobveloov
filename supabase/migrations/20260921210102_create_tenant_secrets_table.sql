/*
# Create tenant_secrets table for encrypted credential storage

1. New Tables
- `tenant_secrets`: stores per-tenant and master integration secrets securely in the database.
  - `id` (uuid, primary key)
  - `tenant_id` (uuid, references companies(id), nullable — NULL means "master/global")
  - `secret_name` (text, not null) — e.g. 'MACHINE_API_KEY', 'TAXIMETRO_USER', 'TAXIMETRO_PASSWORD'
  - `secret_value` (text, not null) — encrypted credential value
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - Unique constraint on (tenant_id, secret_name) — one value per secret per tenant
2. Security
- RLS enabled on `tenant_secrets`.
- Only superadmin and tenant admins can SELECT/INSERT/UPDATE/DELETE.
- The service role (used by edge functions) bypasses RLS entirely.
- anon role has NO access — secrets never exposed to the client.
*/

CREATE TABLE IF NOT EXISTS tenant_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  secret_name text NOT NULL,
  secret_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, secret_name)
);

ALTER TABLE tenant_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tenant_secrets" ON tenant_secrets;
CREATE POLICY "select_tenant_secrets" ON tenant_secrets FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "insert_tenant_secrets" ON tenant_secrets;
CREATE POLICY "insert_tenant_secrets" ON tenant_secrets FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "update_tenant_secrets" ON tenant_secrets;
CREATE POLICY "update_tenant_secrets" ON tenant_secrets FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id
      )
    )
  ) WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "delete_tenant_secrets" ON tenant_secrets;
CREATE POLICY "delete_tenant_secrets" ON tenant_secrets FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR (
      tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_admins ca
        WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_tenant_secrets_tenant ON tenant_secrets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_secrets_name ON tenant_secrets(secret_name);
