/*
# Create system_settings table for secure global platform configuration

1. New Tables
- `system_settings`: stores encrypted global platform secrets and configuration.
  - `id` (uuid, primary key)
  - `key_name` (text, unique, not null) — e.g. 'MASTER_ASAAS_TOKEN', 'GLOBAL_WHATSAPP_CONFIG'
  - `key_value` (text, not null) — the encrypted/stored value
  - `updated_at` (timestamptz)
2. Security
- RLS enabled on `system_settings`.
- Only authenticated users with JWT role = 'superadmin' can SELECT, INSERT, UPDATE, DELETE.
- anon role and tenant_admin role have ZERO access — no read, no write.
- The service role (used by edge functions) bypasses RLS entirely.
3. Important Notes
- This table replaces the use of tenant_secrets with tenant_id=NULL for master secrets.
- The SuperAdmin UI writes MASTER_ASAAS_TOKEN here and never reads it back.
- GLOBAL_WHATSAPP_CONFIG stores a JSON blob with all WhatsApp provider settings.
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_system_settings" ON system_settings;
CREATE POLICY "select_system_settings" ON system_settings FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "insert_system_settings" ON system_settings;
CREATE POLICY "insert_system_settings" ON system_settings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "update_system_settings" ON system_settings;
CREATE POLICY "update_system_settings" ON system_settings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'superadmin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "delete_system_settings" ON system_settings;
CREATE POLICY "delete_system_settings" ON system_settings FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'superadmin');
