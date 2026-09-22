/*
# Create subscription_invoices table

1. New Tables
- `subscription_invoices` — tracks each individual billing cycle invoice sent to Asaas
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK to companies)
  - `plan_id` (uuid, FK to subscription_plans, nullable)
  - `cycle` (text — monthly, quarterly, semiannual, annual)
  - `amount` (numeric — invoice value in BRL)
  - `status` (text — pending, paid, overdue, cancelled)
  - `asaas_payment_id` (text — Asaas payment ID)
  - `asaas_status` (text — raw Asaas payment status)
  - `paid_at` (timestamptz — when payment was confirmed)
  - `due_date` (timestamptz — invoice due date)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `subscription_invoices`.
- Owner-scoped via company_admins membership check (authenticated users can only see invoices for companies they administer).
- Superadmin access via service role key (bypasses RLS).
*/

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES subscription_plans(id) ON DELETE SET NULL,
  cycle text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  asaas_payment_id text,
  asaas_status text,
  paid_at timestamptz,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_invoices" ON subscription_invoices;
CREATE POLICY "select_own_invoices" ON subscription_invoices FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_admins
      WHERE company_admins.company_id = subscription_invoices.company_id
      AND company_admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_invoices" ON subscription_invoices;
CREATE POLICY "insert_own_invoices" ON subscription_invoices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_admins
      WHERE company_admins.company_id = subscription_invoices.company_id
      AND company_admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_invoices" ON subscription_invoices;
CREATE POLICY "update_own_invoices" ON subscription_invoices FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_admins
      WHERE company_admins.company_id = subscription_invoices.company_id
      AND company_admins.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_admins
      WHERE company_admins.company_id = subscription_invoices.company_id
      AND company_admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_invoices" ON subscription_invoices;
CREATE POLICY "delete_own_invoices" ON subscription_invoices FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_admins
      WHERE company_admins.company_id = subscription_invoices.company_id
      AND company_admins.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_company_id ON subscription_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_asaas_payment_id ON subscription_invoices(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
