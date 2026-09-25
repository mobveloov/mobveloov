/*
# Add human takeover columns to bot_conversas

1. Modified Tables
- `bot_conversas` — adds three columns to support human chat intervention:
  - `human_takeover` (boolean, default false) — when true, the bot stops responding to this passenger and a human attendant handles the conversation
  - `taken_over_at` (timestamptz, nullable) — when the takeover started
  - `taken_over_by` (text, nullable) — identifier of the admin who took over

2. Security
- No RLS policy changes. The table remains service-role-only (managed by edge functions).
- The frontend reads/writes this column through the Supabase client with the anon key,
  so we add anon+authenticated SELECT and UPDATE policies scoped to company membership.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_conversas' AND column_name = 'human_takeover') THEN
    ALTER TABLE bot_conversas ADD COLUMN human_takeover boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_conversas' AND column_name = 'taken_over_at') THEN
    ALTER TABLE bot_conversas ADD COLUMN taken_over_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_conversas' AND column_name = 'taken_over_by') THEN
    ALTER TABLE bot_conversas ADD COLUMN taken_over_by text;
  END IF;
END $$;

-- Allow company admins to read and update the takeover flag
DROP POLICY IF EXISTS "anon_select_bot_conversas" ON bot_conversas;
CREATE POLICY "anon_select_bot_conversas"
ON bot_conversas FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_bot_conversas_takeover" ON bot_conversas;
CREATE POLICY "anon_update_bot_conversas_takeover"
ON bot_conversas FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);
