/*
# Multi-Tenant SaaS Schema for Urban Mobility Dispatch

1. Purpose
   Multi-tenant SaaS platform for urban mobility dispatch. Platform owner (superadmin)
   creates tenant companies. Each company gets isolated pricing, rides, WhatsApp config,
   and Machine API credentials. RLS guarantees strict tenant isolation.

2. New Tables
   - companies: tenant records (slug, name, status, brand color)
   - company_admins: links auth.users to companies with role
   - company_settings: per-tenant pricing config
   - company_credentials: per-tenant Machine API key
   - rides: per-tenant ride orders with dispatch tracking
   - whatsapp_instances: per-tenant Evolution API config and QR pairing state
   - admin_logs: per-tenant error/audit logs

3. Security
   - All tables enable RLS.
   - company_admins: auth.uid() ownership check.
   - Tenant-scoped tables: EXISTS subquery to company_admins.
   - companies: superadmin full CRUD; company admins SELECT only.
   - Anon: SELECT active companies + settings, INSERT rides + logs for active companies.

4. Important Notes
   - company_id on every tenant-scoped table.
   - superadmin determined by auth.jwt() ->> 'role' = 'superadmin'.
   - Tables created first, then policies applied.
*/

-- Step 1: Create ALL tables

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  brand_color text DEFAULT '#D4AF37',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  base_fee numeric(10,2) NOT NULL DEFAULT 5.00,
  per_km_rate numeric(10,2) NOT NULL DEFAULT 2.50,
  per_min_rate numeric(10,2) NOT NULL DEFAULT 0.50,
  min_fee numeric(10,2) NOT NULL DEFAULT 8.00,
  surge_multiplier numeric(3,2) NOT NULL DEFAULT 1.00,
  category_label text NOT NULL DEFAULT 'Econômico',
  category_description text NOT NULL DEFAULT 'Veículo compacto, melhor preço',
  eta_minutes integer NOT NULL DEFAULT 5,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_api_url text DEFAULT 'https://api.machine.app/v1',
  machine_api_key text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  passenger_name text NOT NULL,
  passenger_phone text NOT NULL,
  origin_label text NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  destination_label text NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  distance_km double precision NOT NULL DEFAULT 0,
  duration_min double precision NOT NULL DEFAULT 0,
  category_label text NOT NULL DEFAULT 'Econômico',
  estimated_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  vehicle_model text,
  machine_order_id text,
  webhook_events jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  evolution_api_url text,
  evolution_global_token text,
  instance_name text,
  connection_status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  last_connected_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source text NOT NULL,
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  payload jsonb,
  ride_id uuid REFERENCES rides(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Step 2: Enable RLS

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Step 3: Policies

-- companies
DROP POLICY IF EXISTS "select_companies" ON companies;
CREATE POLICY "select_companies" ON companies FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = companies.id)
  );

DROP POLICY IF EXISTS "insert_companies_superadmin" ON companies;
CREATE POLICY "insert_companies_superadmin" ON companies FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "update_companies_superadmin" ON companies;
CREATE POLICY "update_companies_superadmin" ON companies FOR UPDATE
  TO authenticated USING ((auth.jwt() ->> 'role') = 'superadmin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "delete_companies_superadmin" ON companies;
CREATE POLICY "delete_companies_superadmin" ON companies FOR DELETE
  TO authenticated USING ((auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "anon_select_companies" ON companies;
CREATE POLICY "anon_select_companies" ON companies FOR SELECT
  TO anon USING (status = 'active');

-- company_admins
DROP POLICY IF EXISTS "select_own_company_admins" ON company_admins;
CREATE POLICY "select_own_company_admins" ON company_admins FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "insert_own_company_admins" ON company_admins;
CREATE POLICY "insert_own_company_admins" ON company_admins FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "delete_company_admins" ON company_admins;
CREATE POLICY "delete_company_admins" ON company_admins FOR DELETE
  TO authenticated USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'superadmin');

-- company_settings
DROP POLICY IF EXISTS "select_company_settings" ON company_settings;
CREATE POLICY "select_company_settings" ON company_settings FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)
  );

DROP POLICY IF EXISTS "insert_company_settings" ON company_settings;
CREATE POLICY "insert_company_settings" ON company_settings FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)
  );

DROP POLICY IF EXISTS "update_company_settings" ON company_settings;
CREATE POLICY "update_company_settings" ON company_settings FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)
  );

DROP POLICY IF EXISTS "anon_select_company_settings" ON company_settings;
CREATE POLICY "anon_select_company_settings" ON company_settings FOR SELECT
  TO anon USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_settings.company_id AND c.status = 'active'));

-- company_credentials
DROP POLICY IF EXISTS "select_company_credentials" ON company_credentials;
CREATE POLICY "select_company_credentials" ON company_credentials FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)
  );

DROP POLICY IF EXISTS "insert_company_credentials" ON company_credentials;
CREATE POLICY "insert_company_credentials" ON company_credentials FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)
  );

DROP POLICY IF EXISTS "update_company_credentials" ON company_credentials;
CREATE POLICY "update_company_credentials" ON company_credentials FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)
  );

-- rides
DROP POLICY IF EXISTS "select_rides" ON rides;
CREATE POLICY "select_rides" ON rides FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = rides.company_id)
  );

DROP POLICY IF EXISTS "update_rides" ON rides;
CREATE POLICY "update_rides" ON rides FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = rides.company_id)
  );

DROP POLICY IF EXISTS "anon_insert_rides" ON rides;
CREATE POLICY "anon_insert_rides" ON rides FOR INSERT
  TO anon WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = rides.company_id AND c.status = 'active'));

DROP POLICY IF EXISTS "anon_select_rides" ON rides;
CREATE POLICY "anon_select_rides" ON rides FOR SELECT
  TO anon USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = rides.company_id AND c.status = 'active'));

-- whatsapp_instances
DROP POLICY IF EXISTS "select_whatsapp_instances" ON whatsapp_instances;
CREATE POLICY "select_whatsapp_instances" ON whatsapp_instances FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)
  );

DROP POLICY IF EXISTS "insert_whatsapp_instances" ON whatsapp_instances;
CREATE POLICY "insert_whatsapp_instances" ON whatsapp_instances FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)
  );

DROP POLICY IF EXISTS "update_whatsapp_instances" ON whatsapp_instances;
CREATE POLICY "update_whatsapp_instances" ON whatsapp_instances FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)
  );

-- admin_logs
DROP POLICY IF EXISTS "select_admin_logs" ON admin_logs;
CREATE POLICY "select_admin_logs" ON admin_logs FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = admin_logs.company_id)
  );

DROP POLICY IF EXISTS "insert_admin_logs" ON admin_logs;
CREATE POLICY "insert_admin_logs" ON admin_logs FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = admin_logs.company_id)
  );

DROP POLICY IF EXISTS "delete_admin_logs" ON admin_logs;
CREATE POLICY "delete_admin_logs" ON admin_logs FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = admin_logs.company_id)
  );

DROP POLICY IF EXISTS "anon_insert_admin_logs" ON admin_logs;
CREATE POLICY "anon_insert_admin_logs" ON admin_logs FOR INSERT
  TO anon WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = admin_logs.company_id AND c.status = 'active'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rides_company ON rides(company_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created ON rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_company ON admin_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_admins_user ON company_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_company_admins_company ON company_admins(company_id);