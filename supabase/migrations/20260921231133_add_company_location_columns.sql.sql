/*
# Add company location columns

## Purpose
Each tenant company needs to store its operating city and geographic coordinates
so the Machine API categories endpoint can be queried automatically. The Machine
API requires either lat/lng or address+city to return available categories —
storing this per-company means every tenant configures their location once and
the system handles the rest.

## Changes
1. New columns on `company_credentials`:
   - `city` (text, nullable) — operating city name (e.g. "Pitangueiras")
   - `state` (text, nullable) — UF code (e.g. "SP")
   - `lat` (double precision, nullable) — latitude of operating area
   - `lng` (double precision, nullable) — longitude of operating area

2. Backfill: set Hotel Central's location to Pitangueiras/SP with center coordinates.

## Security
No new tables. Existing RLS policies on company_credentials remain unchanged.
*/

ALTER TABLE company_credentials
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

UPDATE company_credentials
  SET city = 'Pitangueiras',
      state = 'SP',
      lat = -21.00944,
      lng = -48.22167
WHERE company_id = (
  SELECT id FROM companies WHERE slug = 'hotel-central' LIMIT 1
)
AND (city IS NULL OR city = '');