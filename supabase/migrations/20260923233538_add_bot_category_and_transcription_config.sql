-- Add category selection per bot connection
ALTER TABLE bot_whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS bot_category_ids uuid[] DEFAULT '{}';

-- Per-company transcription API config
CREATE TABLE IF NOT EXISTS bot_transcription_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'groq',
  api_key text NOT NULL DEFAULT '',
  is_valid boolean NOT NULL DEFAULT false,
  last_tested_at timestamptz,
  last_test_result text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bot_transcription_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bot_transcription_config" ON bot_transcription_config;
CREATE POLICY "select_bot_transcription_config" ON bot_transcription_config FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = bot_transcription_config.company_id)
  );

DROP POLICY IF EXISTS "upsert_bot_transcription_config" ON bot_transcription_config;
CREATE POLICY "upsert_bot_transcription_config" ON bot_transcription_config FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = bot_transcription_config.company_id)
  );

DROP POLICY IF EXISTS "update_bot_transcription_config" ON bot_transcription_config;
CREATE POLICY "update_bot_transcription_config" ON bot_transcription_config FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = bot_transcription_config.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = bot_transcription_config.company_id)
  );

DROP POLICY IF EXISTS "delete_bot_transcription_config" ON bot_transcription_config;
CREATE POLICY "delete_bot_transcription_config" ON bot_transcription_config FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = bot_transcription_config.company_id)
  );
