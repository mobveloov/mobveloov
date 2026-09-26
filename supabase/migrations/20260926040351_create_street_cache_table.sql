/*
# Create street_cache table for fuzzy address matching

1. Purpose
   - Stores successfully geocoded street names per city so the bot can
     do fuzzy matching (Levenshtein-based) before hitting external APIs.
   - When a passenger types "Artu Mequita" and the cache has "Arthur Mesquita",
     the bot can correct it without an external API call.
   - Also caches streets discovered via Nominatim/Photon so the cache grows
     organically as the bot handles more addresses.

2. New Table: street_cache
   - id (uuid, PK)
   - company_id (uuid, FK to companies) — scoped per company
   - city (text) — city name (normalized, no accents)
   - state (text) — state abbreviation
   - street_name (text) — official street name from geocoding (e.g. "Rua Arthur Mesquita")
   - street_name_normalized (text) — normalized version (lowercase, no accents, no special chars)
   - lat (numeric) — latitude of the street
   - lng (numeric) — longitude of the street
   - formatted_address (text) — full formatted address from geocoder
   - created_at (timestamptz)
   - UNIQUE constraint on (company_id, street_name_normalized, city)

3. Index
   - Index on (company_id, city) for fast lookup per city
   - Index on (company_id, street_name_normalized) for exact match lookup

4. Security
   - RLS enabled
   - TO anon, authenticated (the bot webhook runs as service role which bypasses RLS,
     but we add anon policies for completeness)
*/

CREATE TABLE IF NOT EXISTS street_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'SP',
  street_name text NOT NULL,
  street_name_normalized text NOT NULL,
  lat numeric(10,7),
  lng numeric(10,7),
  formatted_address text,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: one entry per normalized street name per company per city
CREATE UNIQUE INDEX IF NOT EXISTS street_cache_company_city_street_uniq
  ON street_cache (company_id, city, street_name_normalized);

-- Fast lookup by company + city
CREATE INDEX IF NOT EXISTS street_cache_company_city_idx
  ON street_cache (company_id, city);

ALTER TABLE street_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_street_cache" ON street_cache;
CREATE POLICY "anon_select_street_cache" ON street_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_street_cache" ON street_cache;
CREATE POLICY "anon_insert_street_cache" ON street_cache FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_street_cache" ON street_cache;
CREATE POLICY "anon_update_street_cache" ON street_cache FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_street_cache" ON street_cache;
CREATE POLICY "anon_delete_street_cache" ON street_cache FOR DELETE
  TO anon, authenticated USING (true);