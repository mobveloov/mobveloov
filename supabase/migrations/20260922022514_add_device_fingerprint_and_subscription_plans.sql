/*
# Add device fingerprint, subscription plans, and plan limits

1. New Tables
- `subscription_plans` — defines plan tiers (Mensal, Trimestral, Semestral, Anual) with totem limits (1, 3, 5, 10)
2. Modified Tables
- `company_locations` — add `device_fingerprint` (text, nullable) for hardware lock
- `companies` — add `plan_id` (uuid, nullable FK), `expires_at` (timestamptz, nullable), `custom_discount` (numeric, nullable)
3. Security
- RLS enabled on `subscription_plans` with anon+authenticated read
- Existing RLS on `company_locations` and `companies` already covers new columns
*/

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  totem_limit INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_plans" ON subscription_plans;
CREATE POLICY "anon_read_plans" ON subscription_plans
  FOR SELECT TO anon, authenticated USING (true);

-- Seed default plans
INSERT INTO subscription_plans (name, billing_period, totem_limit, price, sort_order) VALUES
  ('Starter Mensal', 'monthly', 1, 99.00, 1),
  ('Básico Trimestral', 'quarterly', 3, 249.00, 2),
  ('Profissional Semestral', 'semiannual', 5, 449.00, 3),
  ('Empresarial Anual', 'annual', 10, 799.00, 4)
ON CONFLICT DO NOTHING;

-- Add device_fingerprint to company_locations (kiosks/totems)
ALTER TABLE company_locations
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Add subscription columns to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_discount NUMERIC(10,2) DEFAULT 0;

-- Allow authenticated users to update company_locations.device_fingerprint (already covered by existing policies)
-- Allow superadmin to update companies plan fields (existing update policy covers this)
