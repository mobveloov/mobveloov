/*
# Add fixed pickup address to company_locations

1. Modified Tables
- `company_locations`: adds `pickup_address` (text, nullable) — the fixed street address
  the totem uses as the passenger's origin, replacing GPS-based detection.
  Also adds `pickup_lat` and `pickup_lng` (double precision, nullable) for the
  geocoded coordinates of that address, so the Machine API receives accurate lat/lng.

2. Security
- No new tables. RLS already enabled on `company_locations`.
- No policy changes needed — existing policies already cover the new columns.

3. Notes
- When `pickup_address` is set, the totem skips GPS and uses this address as the
  passenger's origin. The passenger only enters the destination.
- When `pickup_address` is null/empty, the totem falls back to GPS (current behavior).
- The admin panel lets the company search for a precise street address (not just city)
  via Nominatim autocomplete, and the lat/lng is filled automatically.
*/

ALTER TABLE company_locations
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision;
