/*
# Add Meta Cloud API fields to bot_whatsapp_conexoes

1. Modified Tables
- `bot_whatsapp_conexoes`: add `meta_phone_id` (text, nullable) — the WhatsApp Business phone number ID from Meta Cloud API,
  and `meta_waba_id` (text, nullable) — the WhatsApp Business Account ID from Meta Cloud API.
  These columns allow the webhook to match incoming Meta Cloud messages to the correct bot connection.
2. Security
- No policy changes — existing RLS covers the new columns.
3. Notes
- The `evolution_global_token` column is reused to store the Meta Cloud access token (the "token" field from the create form).
- For Evolution API connections, these new columns stay NULL and are ignored.
*/

ALTER TABLE bot_whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS meta_phone_id text,
  ADD COLUMN IF NOT EXISTS meta_waba_id text;

CREATE INDEX IF NOT EXISTS bot_whatsapp_conexoes_meta_phone_idx ON bot_whatsapp_conexoes (meta_phone_id);
