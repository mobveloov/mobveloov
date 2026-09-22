/*
# Create company_locations table and link categories + rides to locations

## Purpose
Each tenant company (e.g. Upcorridas) can operate in multiple cities/branches
(e.g. Leme, Jaboticabal, Hospital). Each location gets its own totem URL in the
format /empresa-slug/local-slug (e.g. /upcorridas/hospital) and can have its own
set of vehicle categories, independent pricing, and GPS coordinates.

## New Tables
- company_locations: per-tenant physical locations
  - id, company_id, slug, name, city, state, lat, lng, is_active, sort_order, created_at, updated_at
  - Unique constraint on (company_id, slug) so each company's location slugs are unique

## Modified Tables
- vehicle_categories: add optional location_id column
  - When location_id is NULL, the category applies to all locations of the company
  - When location_id is set, the category is exclusive to that location
- rides: add optional location_id column to track which location generated the ride

## Security
- RLS enabled on company_locations
- Admin policies: tenant-scoped via company_admins (same pattern as vehicle_categories)
- Anon SELECT: can read active locations for active companies (so the totem URL works)
- vehicle_categories and rides existing policies unchanged — the new location_id
  column inherits the same tenant-scoping through company_id

## Important Notes
1. The location_id on vehicle_categories is nullable for backward compatibility —
   existing categories without a location remain visible at all locations.
2. The unique constraint is (company_id, slug), NOT just slug — so two different
   companies can both have a location called "hospital".
3. A default location is NOT auto-created — the admin creates locations via the panel.
*/

CREATE TABLE IF NOT EXISTS company_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  city text,
  state text,
  lat double precision,
  lng double precision,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

-- Admin policies (tenant-scoped)
DROP POLICY IF EXISTS "select_company_locations" ON company_locations;
CREATE POLICY "select_company_locations" ON company_locations FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)
  );

DROP POLICY IF EXISTS "insert_company_locations" ON company_locations;
CREATE POLICY "insert_company_locations" ON company_locations FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)
  );

DROP POLICY IF EXISTS "update_company_locations" ON company_locations;
CREATE POLICY "update_company_locations" ON company_locations FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)
  );

DROP POLICY IF EXISTS "delete_company_locations" ON company_locations;
CREATE POLICY "delete_company_locations" ON company_locations FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)
  );

-- Anon can read active locations for active companies
DROP POLICY IF EXISTS "anon_select_company_locations" ON company_locations;
CREATE POLICY "anon_select_company_locations" ON company_locations FOR SELECT
  TO anon USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM companies c WHERE c.id = company_locations.company_id AND c.status = 'active')
  );

-- Add location_id to vehicle_categories (nullable for backward compatibility)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_categories' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE vehicle_categories ADD COLUMN location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location_id to rides
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE rides ADD COLUMN location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_locations_company ON company_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_locations_slug ON company_locations(company_id, slug);
CREATE INDEX IF NOT EXISTS idx_vehicle_categories_location ON vehicle_categories(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_location ON rides(location_id) WHERE location_id IS NOT NULL;