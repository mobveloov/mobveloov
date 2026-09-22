/*
# Universal Integration Engine: Categories, Drivers, Webhook Config

1. Purpose
   Transforms the platform from a single-integration (Machine API only) into a
   universal white-label dispatch platform with three integration modes:
   - Manual: local dispatch board + driver assignment + WhatsApp notification
   - Machine: Machine API integration (existing)
   - Webhook: generic webhook gateway with custom headers + payload mapping

   Also replaces the single-category pricing model with a multi-category system
   (Econômico, Conforto, Executivo) where each category has independent pricing.

2. New Tables
   - vehicle_categories: per-tenant vehicle categories with independent pricing
     (label, description, base_fee, per_km_rate, per_min_rate, min_fee, eta_minutes,
      sort_order, is_active)
   - drivers: per-tenant driver roster for manual dispatch mode
     (name, phone, vehicle_plate, vehicle_model, is_available)

3. Modified Tables
   - company_settings: add integration_mode column (text, default 'manual')
   - company_credentials: add webhook_url, webhook_headers, webhook_payload_template
     columns for generic webhook mode

4. Security
   - RLS enabled on vehicle_categories and drivers (tenant-scoped via company_admins)
   - Anon can SELECT active vehicle_categories for active companies
   - All existing policies preserved

5. Important Notes
   - The old company_settings.category_label and category_description columns are
     kept for backward compatibility but the vehicle_categories table is now the
     source of truth for category display.
   - Default categories (Econômico, Conforto, Executivo) are NOT auto-inserted here;
     the admin UI creates them on first save if none exist.
*/

-- Add integration_mode to company_settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'integration_mode'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN integration_mode text NOT NULL DEFAULT 'manual';
  END IF;
END $$;

-- Add webhook config columns to company_credentials
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credentials' AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE company_credentials ADD COLUMN webhook_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credentials' AND column_name = 'webhook_headers'
  ) THEN
    ALTER TABLE company_credentials ADD COLUMN webhook_headers jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credentials' AND column_name = 'webhook_payload_template'
  ) THEN
    ALTER TABLE company_credentials ADD COLUMN webhook_payload_template text;
  END IF;
END $$;

-- Create vehicle_categories table
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  base_fee numeric(10,2) NOT NULL DEFAULT 5.00,
  per_km_rate numeric(10,2) NOT NULL DEFAULT 2.50,
  per_min_rate numeric(10,2) NOT NULL DEFAULT 0.50,
  min_fee numeric(10,2) NOT NULL DEFAULT 8.00,
  eta_minutes integer NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  vehicle_plate text,
  vehicle_model text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- vehicle_categories policies (tenant-scoped for admin, anon read for active companies)
DROP POLICY IF EXISTS "select_vehicle_categories" ON vehicle_categories;
CREATE POLICY "select_vehicle_categories" ON vehicle_categories FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)
  );

DROP POLICY IF EXISTS "insert_vehicle_categories" ON vehicle_categories;
CREATE POLICY "insert_vehicle_categories" ON vehicle_categories FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)
  );

DROP POLICY IF EXISTS "update_vehicle_categories" ON vehicle_categories;
CREATE POLICY "update_vehicle_categories" ON vehicle_categories FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)
  );

DROP POLICY IF EXISTS "delete_vehicle_categories" ON vehicle_categories;
CREATE POLICY "delete_vehicle_categories" ON vehicle_categories FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)
  );

DROP POLICY IF EXISTS "anon_select_vehicle_categories" ON vehicle_categories;
CREATE POLICY "anon_select_vehicle_categories" ON vehicle_categories FOR SELECT
  TO anon USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM companies c WHERE c.id = vehicle_categories.company_id AND c.status = 'active')
  );

-- drivers policies (tenant-scoped, admin only — drivers are NOT exposed to anon)
DROP POLICY IF EXISTS "select_drivers" ON drivers;
CREATE POLICY "select_drivers" ON drivers FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)
  );

DROP POLICY IF EXISTS "insert_drivers" ON drivers;
CREATE POLICY "insert_drivers" ON drivers FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)
  );

DROP POLICY IF EXISTS "update_drivers" ON drivers;
CREATE POLICY "update_drivers" ON drivers FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)
  );

DROP POLICY IF EXISTS "delete_drivers" ON drivers;
CREATE POLICY "delete_drivers" ON drivers FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_categories_company ON vehicle_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(company_id, is_available);

-- Also allow anon to read integration_mode from company_settings
-- (already covered by existing anon_select_company_settings policy)
