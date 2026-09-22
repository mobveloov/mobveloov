/*
# Create SuperAdmin Notifications + Profile Fields

1. New Tables
- `superadmin_notifications` — notifications for the superadmin panel (title, message, type, read/unread, created_at)
  - Types: new_pending_company, totem_offline, invoice_overdue, company_created
  - RLS: authenticated only (superadmin panel users)

2. Modified Tables
- `internal_users` — add columns for profile management:
  - `phone` (text, nullable) — contact phone
  - `company_name` (text, nullable) — legal entity name (Veloov Mobilidade)
  - `cnpj` (text, nullable) — CNPJ of the platform owner
  - `avatar_url` (text, nullable) — profile avatar image URL
  - `two_factor_enabled` (boolean, default false) — 2FA toggle

3. Security
- RLS enabled on superadmin_notifications.
- All policies scoped to authenticated (superadmin panel users).
- internal_users already has RLS enabled; existing policies remain.

4. Important Notes
- The notifications table is designed to be written to by edge functions (register-company, etc.)
  and read/updated by the superadmin panel frontend.
- Profile fields on internal_users are editable only by the user themselves (frontend enforces).
*/

-- ════════ ADD PROFILE COLUMNS TO internal_users ════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_users' AND column_name = 'phone') THEN
    ALTER TABLE internal_users ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_users' AND column_name = 'company_name') THEN
    ALTER TABLE internal_users ADD COLUMN company_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_users' AND column_name = 'cnpj') THEN
    ALTER TABLE internal_users ADD COLUMN cnpj text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_users' AND column_name = 'avatar_url') THEN
    ALTER TABLE internal_users ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_users' AND column_name = 'two_factor_enabled') THEN
    ALTER TABLE internal_users ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ════════ CREATE superadmin_notifications TABLE ════════
CREATE TABLE IF NOT EXISTS superadmin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  related_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE superadmin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_notifications" ON superadmin_notifications;
CREATE POLICY "select_notifications" ON superadmin_notifications FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_notifications" ON superadmin_notifications;
CREATE POLICY "insert_notifications" ON superadmin_notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_notifications" ON superadmin_notifications;
CREATE POLICY "update_notifications" ON superadmin_notifications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_notifications" ON superadmin_notifications;
CREATE POLICY "delete_notifications" ON superadmin_notifications FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON superadmin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON superadmin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON superadmin_notifications(type);

-- Enable realtime for superadmin_notifications
ALTER TABLE superadmin_notifications REPLICA IDENTITY FULL;
