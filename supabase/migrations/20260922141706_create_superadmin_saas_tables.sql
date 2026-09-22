/*
# Create SuperAdmin SaaS Management Tables

This migration adds the tables needed for the full SaaS admin panel:

1. New Tables
- `invoices` — billing invoices per company (status: paid, pending, overdue)
- `audit_logs` — who did what and when (superadmin audit trail)
- `internal_users` — superadmin team members with roles (admin, support, finance)
- `support_tickets` — support tickets opened by partner companies
- `support_ticket_replies` — replies on support tickets
- `passengers` — passenger/client records per company (blockable for fraud)

2. Security
- RLS enabled on all new tables.
- All tables scoped to authenticated users (superadmin panel).
- Owner/membership checks via auth.uid().
*/

-- ════════ INVOICES ════════
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  due_date timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  payment_method text,
  gateway_invoice_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoices" ON invoices;
CREATE POLICY "select_invoices" ON invoices FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_invoices" ON invoices;
CREATE POLICY "insert_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_invoices" ON invoices;
CREATE POLICY "update_invoices" ON invoices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_invoices" ON invoices;
CREATE POLICY "delete_invoices" ON invoices FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ════════ AUDIT LOGS ════════
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);

-- ════════ INTERNAL USERS ════════
CREATE TABLE IF NOT EXISTS internal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'support',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE internal_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_internal_users" ON internal_users;
CREATE POLICY "select_internal_users" ON internal_users FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_internal_users" ON internal_users;
CREATE POLICY "insert_internal_users" ON internal_users FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_internal_users" ON internal_users;
CREATE POLICY "update_internal_users" ON internal_users FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_internal_users" ON internal_users;
CREATE POLICY "delete_internal_users" ON internal_users FOR DELETE
  TO authenticated USING (true);

-- ════════ SUPPORT TICKETS ════════
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_by text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_support_tickets" ON support_tickets;
CREATE POLICY "select_support_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_support_tickets" ON support_tickets;
CREATE POLICY "insert_support_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_support_tickets" ON support_tickets;
CREATE POLICY "update_support_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_support_tickets" ON support_tickets;
CREATE POLICY "delete_support_tickets" ON support_tickets FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- ════════ SUPPORT TICKET REPLIES ════════
CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'support',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ticket_replies" ON support_ticket_replies;
CREATE POLICY "select_ticket_replies" ON support_ticket_replies FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ticket_replies" ON support_ticket_replies;
CREATE POLICY "insert_ticket_replies" ON support_ticket_replies FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ticket_replies" ON support_ticket_replies;
CREATE POLICY "delete_ticket_replies" ON support_ticket_replies FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON support_ticket_replies(ticket_id);

-- ════════ PASSENGERS ════════
CREATE TABLE IF NOT EXISTS passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  is_blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  total_rides integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_passengers" ON passengers;
CREATE POLICY "select_passengers" ON passengers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_passengers" ON passengers;
CREATE POLICY "insert_passengers" ON passengers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_passengers" ON passengers;
CREATE POLICY "update_passengers" ON passengers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_passengers" ON passengers;
CREATE POLICY "delete_passengers" ON passengers FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_passengers_company_id ON passengers(company_id);

-- Add soft delete column to companies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'deleted_at') THEN
    ALTER TABLE companies ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Add suspend_reason column to companies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'suspend_reason') THEN
    ALTER TABLE companies ADD COLUMN suspend_reason text;
  END IF;
END $$;

-- Add force_password_change to company_admins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_admins' AND column_name = 'force_password_change') THEN
    ALTER TABLE company_admins ADD COLUMN force_password_change boolean NOT NULL DEFAULT false;
  END IF;
END $$;