/*
# Migrate shared vehicle_categories to per-totem isolation

## Problem
The vehicle_categories table has a nullable location_id column. When location_id
is NULL, the category is "shared" across all totens of a company. The PricingPanel
loads ALL categories at once and saves them all together, so editing categories
while viewing one totem can silently delete or overwrite categories belonging to
other totens.

## Solution
1. For each company, find all vehicle_categories with location_id IS NULL
   (shared categories).
2. For each company_location that belongs to that company and does NOT already
   have a category with the same label, duplicate the shared category with
   location_id set to that location's id.
3. After duplication, delete the original shared (location_id IS NULL) categories
   so no category remains ambiguous.
4. Add a NOT NULL constraint on location_id so every category is explicitly
   tied to a totem going forward.

## Important notes
- If a company has NO locations, shared categories are left in place with
  location_id = NULL temporarily (the constraint is only applied if no NULL
  rows remain). This is an edge case that shouldn't happen in production since
  every company should have at least one totem.
- The duplication preserves all fields: label, description, pricing, machine
  category linkage, sort_order, is_active.
- Categories that already have a location_id set are untouched.
*/

-- Step 1: Duplicate shared categories (location_id IS NULL) to each location
-- that doesn't already have a category with the same label.
DO $$
DECLARE
  cat_record RECORD;
  loc_record RECORD;
  existing_count INTEGER;
BEGIN
  -- Iterate over each shared category
  FOR cat_record IN
    SELECT id, company_id, label, description, base_fee, per_km_rate,
           per_min_rate, min_fee, eta_minutes, sort_order, is_active,
           machine_category_id, machine_category_name
    FROM vehicle_categories
    WHERE location_id IS NULL
  LOOP
    -- For each location of this company, create a copy if one with same label doesn't exist
    FOR loc_record IN
      SELECT id FROM company_locations
      WHERE company_id = cat_record.company_id
      ORDER BY sort_order ASC
    LOOP
      SELECT COUNT(*) INTO existing_count
      FROM vehicle_categories
      WHERE company_id = cat_record.company_id
        AND location_id = loc_record.id
        AND label = cat_record.label;

      IF existing_count = 0 THEN
        INSERT INTO vehicle_categories (
          company_id, location_id, label, description, base_fee,
          per_km_rate, per_min_rate, min_fee, eta_minutes,
          sort_order, is_active, machine_category_id, machine_category_name
        ) VALUES (
          cat_record.company_id, loc_record.id, cat_record.label,
          cat_record.description, cat_record.base_fee, cat_record.per_km_rate,
          cat_record.per_min_rate, cat_record.min_fee, cat_record.eta_minutes,
          cat_record.sort_order, cat_record.is_active,
          cat_record.machine_category_id, cat_record.machine_category_name
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Step 2: Delete the original shared categories (location_id IS NULL)
-- Only if the company has at least one location (meaning copies were made)
DELETE FROM vehicle_categories
WHERE location_id IS NULL
  AND company_id IN (
    SELECT id FROM companies WHERE id IN (
      SELECT DISTINCT company_id FROM company_locations
    )
  );

-- Step 3: Check if any NULL location_id rows remain (companies with no locations)
-- If none remain, add NOT NULL constraint
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM vehicle_categories WHERE location_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE vehicle_categories ALTER COLUMN location_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Add an index for efficient per-location queries
CREATE INDEX IF NOT EXISTS idx_vehicle_categories_company_location
  ON vehicle_categories(company_id, location_id);
