/*
# Add bot_connection_id to company_locations — per-instance bot locations

## Purpose
Each bot WhatsApp instance now has its OWN private set of locations, completely
independent from other bot instances and from totem locations. Previously all
locations were shared across the whole company, so every bot instance saw every
location — including totem locations created in the Locations panel.

## Changes
1. Added `bot_connection_id` column (nullable uuid) to `company_locations`.
   - When NULL: the location is a totem location (created via LocationsPanel).
   - When set: the location belongs exclusively to that bot WhatsApp connection.
2. Added a foreign key: bot_connection_id → bot_whatsapp_conexoes(id) ON DELETE CASCADE.
   - If a bot connection is deleted, its private locations are deleted too.
3. Added an index on bot_connection_id for fast per-instance queries.
4. Replaced the unique constraint with a unique index that allows the same slug
   across different bot instances (and totems) without colliding.

## Security
- No RLS policy changes. Existing policies already scope by company_id.
- The anon SELECT policy still works for totem locations (bot_connection_id IS NULL).

## Important Notes
1. Existing locations keep bot_connection_id = NULL → they remain totem locations.
2. The totem LocationsPanel filters bot_connection_id IS NULL so it only shows totems.
3. The bot panel edge function filters by bot_connection_id so each instance only
   sees its own locations. Deleting a bot location does NOT affect totems or other bots.
*/
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_locations' AND column_name = 'bot_connection_id'
  ) THEN
    ALTER TABLE company_locations ADD COLUMN bot_connection_id uuid REFERENCES bot_whatsapp_conexoes(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_locations_bot_conn ON company_locations(bot_connection_id) WHERE bot_connection_id IS NOT NULL;

-- Replace the unique constraint with a scope-aware unique index
ALTER TABLE company_locations DROP CONSTRAINT IF EXISTS company_locations_company_id_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_locations_unique_per_scope
  ON company_locations (company_id, COALESCE(bot_connection_id, '00000000-0000-0000-0000-000000000000'), slug);
