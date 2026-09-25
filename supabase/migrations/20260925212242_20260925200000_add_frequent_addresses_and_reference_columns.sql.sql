/*
# Add frequent passenger addresses table

1. New Tables
- `passenger_frequent_addresses` — stores addresses that passengers use repeatedly
  - `id` (uuid, primary key)
  - `company_id` (uuid, references companies)
  - `phone` (text) — passenger phone number
  - `address_text` (text) — the raw address text the passenger typed
  - `address_formatted` (text) — the formatted address from geocoding
  - `address_lat` (double precision) — latitude
  - `address_lng` (double precision) — longitude
  - `origin_reference` (text) — the reference text shown to drivers
  - `use_count` (integer, default 1) — how many times this address was used
  - `last_used_at` (timestamptz) — when it was last used
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `passenger_frequent_addresses`.
- Allow anon + authenticated CRUD since this is a bot-managed table (no user login).
- The edge function uses the service role key which bypasses RLS.

3. Indexes
- Composite index on (company_id, phone, address_text) for fast lookups
- Index on (company_id, phone, use_count desc) for frequent address queries

4. Important Notes
- Addresses are matched by normalized phone + similar address text
- The bot will offer frequent addresses as quick-pick buttons when a passenger starts a new ride
- Only addresses used 2+ times are considered "frequent"
*/

CREATE TABLE IF NOT EXISTS passenger_frequent_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  address_text text NOT NULL,
  address_formatted text,
  address_lat double precision,
  address_lng double precision,
  origin_reference text,
  use_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE passenger_frequent_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_passenger_addresses" ON passenger_frequent_addresses;
CREATE POLICY "anon_select_passenger_addresses"
ON passenger_frequent_addresses FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_passenger_addresses" ON passenger_frequent_addresses;
CREATE POLICY "anon_insert_passenger_addresses"
ON passenger_frequent_addresses FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_passenger_addresses" ON passenger_frequent_addresses;
CREATE POLICY "anon_update_passenger_addresses"
ON passenger_frequent_addresses FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_passenger_addresses" ON passenger_frequent_addresses;
CREATE POLICY "anon_delete_passenger_addresses"
ON passenger_frequent_addresses FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_passenger_freq_addr_lookup
ON passenger_frequent_addresses (company_id, phone, address_text);

CREATE INDEX IF NOT EXISTS idx_passenger_freq_addr_top
ON passenger_frequent_addresses (company_id, phone, use_count DESC);
