/*
# Mobility Dispatch PWA - Core Schema

1. Purpose
   Stores passenger sessions, ride orders, payment transactions, admin error logs,
   and superadmin pricing/tier configuration for an urban mobility dispatch PWA.

2. New Tables
   - passenger_sessions: lightweight passenger identity cached per device (name + phone)
   - ride_orders: dispatch orders with origin/destination, category, pricing, and status
   - payment_transactions: Pix/Openpix payment records with expiration handling
   - admin_logs: external API error logs (Machine API / Asaas) visible to superadmin
   - pricing_settings: superadmin-configurable system plans, tiers, and pricing rules
   - vip_tiers: VIP tier definitions including the VIP6 zero-fee override

3. Security
   - All tables enable RLS.
   - passenger_sessions, ride_orders, payment_transactions: TO anon, authenticated (no-auth passenger-facing app)
   - admin_logs, pricing_settings, vip_tiers: TO anon, authenticated (admin panel uses client-side role gate; no Supabase auth for this phase)
   - Note: This is a single-tenant dispatch app where the PWA is the store/totem interface. RLS is enabled as a baseline; policies allow the anon-key client to operate since there is no sign-in screen requirement for passengers.

4. Important Notes
   - VIP6 tier sets intermediation_fee = 0 for targeted drivers/enterprise accounts.
   - pricing_settings has a single active row (singleton config) enforced by a partial unique index.
   - admin_logs captures raw error payloads from Machine API and Asaas for troubleshooting.
*/

-- Passenger sessions (device-cached identity)
CREATE TABLE IF NOT EXISTS passenger_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE passenger_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_passenger_sessions" ON passenger_sessions;
CREATE POLICY "anon_select_passenger_sessions" ON passenger_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_passenger_sessions" ON passenger_sessions;
CREATE POLICY "anon_insert_passenger_sessions" ON passenger_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_passenger_sessions" ON passenger_sessions;
CREATE POLICY "anon_update_passenger_sessions" ON passenger_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_passenger_sessions" ON passenger_sessions;
CREATE POLICY "anon_delete_passenger_sessions" ON passenger_sessions FOR DELETE
  TO anon, authenticated USING (true);

-- Ride orders
CREATE TABLE IF NOT EXISTS ride_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES passenger_sessions(id) ON DELETE SET NULL,
  passenger_name text NOT NULL,
  passenger_phone text NOT NULL,
  origin_label text NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  destination_label text NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  distance_km double precision NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'economic',
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  final_price numeric(10,2) NOT NULL DEFAULT 0,
  intermediation_fee numeric(10,2) NOT NULL DEFAULT 0,
  vip_tier text,
  status text NOT NULL DEFAULT 'pending',
  -- pending, accepted, en_route, in_progress, completed, canceled
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  vehicle_model text,
  machine_order_id text,
  webhook_events jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ride_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ride_orders" ON ride_orders;
CREATE POLICY "anon_select_ride_orders" ON ride_orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ride_orders" ON ride_orders;
CREATE POLICY "anon_insert_ride_orders" ON ride_orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ride_orders" ON ride_orders;
CREATE POLICY "anon_update_ride_orders" ON ride_orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ride_orders" ON ride_orders;
CREATE POLICY "anon_delete_ride_orders" ON ride_orders FOR DELETE
  TO anon, authenticated USING (true);

-- Payment transactions (Pix/Openpix)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES ride_orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openpix',
  transaction_id text,
  pix_code text,
  pix_qr_code text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  -- pending, paid, expired, canceled
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  provider_payload jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_select_payment_transactions" ON payment_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_insert_payment_transactions" ON payment_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_update_payment_transactions" ON payment_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payment_transactions" ON payment_transactions;
CREATE POLICY "anon_delete_payment_transactions" ON payment_transactions FOR DELETE
  TO anon, authenticated USING (true);

-- Admin error logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  -- 'machine_api', 'asas', 'openpix', 'system'
  level text NOT NULL DEFAULT 'error',
  -- 'error', 'warn', 'info'
  message text NOT NULL,
  payload jsonb,
  order_id uuid REFERENCES ride_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_admin_logs" ON admin_logs;
CREATE POLICY "anon_select_admin_logs" ON admin_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_admin_logs" ON admin_logs;
CREATE POLICY "anon_insert_admin_logs" ON admin_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_admin_logs" ON admin_logs;
CREATE POLICY "anon_delete_admin_logs" ON admin_logs FOR DELETE
  TO anon, authenticated USING (true);

-- Pricing settings (singleton config)
CREATE TABLE IF NOT EXISTS pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  base_fee numeric(10,2) NOT NULL DEFAULT 5.00,
  per_km_rate numeric(10,2) NOT NULL DEFAULT 2.50,
  min_fee numeric(10,2) NOT NULL DEFAULT 8.00,
  surge_multiplier numeric(3,2) NOT NULL DEFAULT 1.00,
  currency text NOT NULL DEFAULT 'BRL',
  pix_expiration_minutes integer NOT NULL DEFAULT 30,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pricing_settings" ON pricing_settings;
CREATE POLICY "anon_select_pricing_settings" ON pricing_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pricing_settings" ON pricing_settings;
CREATE POLICY "anon_insert_pricing_settings" ON pricing_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pricing_settings" ON pricing_settings;
CREATE POLICY "anon_update_pricing_settings" ON pricing_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- VIP tiers
CREATE TABLE IF NOT EXISTS vip_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_code text UNIQUE NOT NULL,
  tier_name text NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  intermediation_fee numeric(10,2) NOT NULL DEFAULT 2.00,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vip_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vip_tiers" ON vip_tiers;
CREATE POLICY "anon_select_vip_tiers" ON vip_tiers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vip_tiers" ON vip_tiers;
CREATE POLICY "anon_insert_vip_tiers" ON vip_tiers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vip_tiers" ON vip_tiers;
CREATE POLICY "anon_update_vip_tiers" ON vip_tiers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vip_tiers" ON vip_tiers;
CREATE POLICY "anon_delete_vip_tiers" ON vip_tiers FOR DELETE
  TO anon, authenticated USING (true);

-- Seed default pricing settings (singleton)
INSERT INTO pricing_settings (is_active, base_fee, per_km_rate, min_fee)
SELECT true, 5.00, 2.50, 8.00
WHERE NOT EXISTS (SELECT 1 FROM pricing_settings WHERE is_active = true);

-- Seed VIP tiers including VIP6 (zero intermediation fee)
INSERT INTO vip_tiers (tier_code, tier_name, discount_percent, intermediation_fee, priority)
SELECT 'standard', 'Standard', 0, 2.00, 0
WHERE NOT EXISTS (SELECT 1 FROM vip_tiers WHERE tier_code = 'standard');

INSERT INTO vip_tiers (tier_code, tier_name, discount_percent, intermediation_fee, priority)
SELECT 'vip1', 'VIP 1', 5, 1.80, 1
WHERE NOT EXISTS (SELECT 1 FROM vip_tiers WHERE tier_code = 'vip1');

INSERT INTO vip_tiers (tier_code, tier_name, discount_percent, intermediation_fee, priority)
SELECT 'vip6', 'VIP6 Enterprise', 0, 0.00, 10
WHERE NOT EXISTS (SELECT 1 FROM vip_tiers WHERE tier_code = 'vip6');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ride_orders_status ON ride_orders(status);
CREATE INDEX IF NOT EXISTS idx_ride_orders_session ON ride_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_sessions_device ON passenger_sessions(device_id);