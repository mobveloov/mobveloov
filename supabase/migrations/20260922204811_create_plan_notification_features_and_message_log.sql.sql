/*
# Plan notification features + WhatsApp message log

1. New Tables
- `plan_notification_features`: configurable per-plan WhatsApp notification rules.
  One row per subscription plan. Defines what notifications are sent to passengers
  (driver info on assign, ETA inclusion, distance update frequency in minutes).
  Replaces hardcoded tier logic in edge functions so rules can be adjusted
  without code changes.
  Columns:
    - plan_id (uuid FK → subscription_plans, PK)
    - send_driver_info (bool, default true)
    - send_eta (bool, default false)
    - distance_update_interval_min (int, default 0) — 0 = no periodic updates
    - updated_at (timestamptz)

- `whatsapp_message_log`: tracks every WhatsApp message sent to passengers for
  cost monitoring per company per month.
  Columns:
    - id (uuid PK)
    - company_id (uuid FK → companies)
    - ride_id (uuid FK → rides, nullable)
    - phone (text)
    - message_type (text)
    - message_body (text)
    - provider (text)
    - success (bool)
    - error (text, nullable)
    - sent_at (timestamptz, default now())
    - billing_month (text) — 'YYYY-MM' for fast monthly grouping

2. Seed data
- Inserts default notification features for existing plans:
  Bronze: driver info only, no ETA, no distance updates
  Prata: driver info + ETA, no distance updates
  Ouro: driver info + ETA, distance updates every 5 minutes
  Black: driver info + ETA, distance updates every 2 minutes
  Diamante: driver info + ETA, distance updates every 2 minutes

3. Indexes
- idx_wa_msg_log_company_month on (company_id, billing_month)
- idx_wa_msg_log_ride on (ride_id)

4. Security
- RLS enabled on both tables.
- plan_notification_features: SELECT for anon+authenticated.
- whatsapp_message_log: SELECT for authenticated tenant admins (own company only).
*/

CREATE TABLE IF NOT EXISTS plan_notification_features (
  plan_id uuid PRIMARY KEY REFERENCES subscription_plans(id) ON DELETE CASCADE,
  send_driver_info boolean NOT NULL DEFAULT true,
  send_eta boolean NOT NULL DEFAULT false,
  distance_update_interval_min integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plan_notification_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_plan_notification_features" ON plan_notification_features;
CREATE POLICY "read_plan_notification_features"
  ON plan_notification_features FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ride_id uuid REFERENCES rides(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message_type text NOT NULL,
  message_body text,
  provider text NOT NULL DEFAULT 'evolution',
  success boolean NOT NULL DEFAULT true,
  error text,
  sent_at timestamptz DEFAULT now(),
  billing_month text NOT NULL DEFAULT to_char(now(), 'YYYY-MM')
);

ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_whatsapp_message_log" ON whatsapp_message_log;
CREATE POLICY "read_own_whatsapp_message_log"
  ON whatsapp_message_log FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_admins
      WHERE company_admins.company_id = whatsapp_message_log.company_id
      AND company_admins.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_company_month
  ON whatsapp_message_log(company_id, billing_month);

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_ride
  ON whatsapp_message_log(ride_id);

-- Seed default notification features for existing plans
INSERT INTO plan_notification_features (plan_id, send_driver_info, send_eta, distance_update_interval_min)
SELECT
  sp.id,
  true,
  (sp.message_tier IN ('B', 'C')),
  CASE
    WHEN sp.name ILIKE '%ouro%' THEN 5
    WHEN sp.name ILIKE '%black%' THEN 2
    WHEN sp.name ILIKE '%diamante%' THEN 2
    ELSE 0
  END
FROM subscription_plans sp
ON CONFLICT (plan_id) DO NOTHING;
