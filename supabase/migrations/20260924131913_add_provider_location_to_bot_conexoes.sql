/*
# Add provider and location_id to bot_whatsapp_conexoes

1. Modified Tables
- `bot_whatsapp_conexoes`: add `provider` (text, default 'evolution') to support multiple WhatsApp providers,
  and `location_id` (uuid, nullable, FK to company_locations) to tie a bot connection to a specific city/location.
2. Security
- No policy changes — existing RLS covers the new columns.
*/

ALTER TABLE bot_whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bot_whatsapp_conexoes_location_idx ON bot_whatsapp_conexoes (location_id);
