/*
# Add provider_token and provider_api_url to bot_whatsapp_conexoes

1. Modified Tables
- `bot_whatsapp_conexoes`: add `provider_token` (text, nullable) — stores the access token for Z-API, Z-Pro, Meta Cloud, and custom webhook providers.
- `bot_whatsapp_conexoes`: add `provider_api_url` (text, nullable) — stores the API base URL for Z-API, Z-Pro, and custom webhook providers.
- `bot_whatsapp_conexoes`: add `provider_waba_id` (text, nullable) — stores the WhatsApp Business Account ID for Z-API/Z-Pro (client token) or Meta Cloud (WABA ID).
- `bot_whatsapp_conexoes`: add `provider_phone_id` (text, nullable) — stores the phone number ID for Meta Cloud API (separate from meta_phone_id for consistency with whatsapp_instances).
2. Security
- No policy changes — existing RLS covers the new columns.
3. Notes
- For Evolution API connections, these columns stay NULL and are ignored.
- For Z-API/Z-Pro: provider_api_url = API URL, provider_token = instance token, provider_waba_id = client token.
- For Meta Cloud: provider_token = access token, provider_phone_id = phone number ID, provider_waba_id = WABA ID.
- The existing evolution_api_url and evolution_global_token columns are still used for Evolution API only.
*/

ALTER TABLE bot_whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS provider_token text,
  ADD COLUMN IF NOT EXISTS provider_api_url text,
  ADD COLUMN IF NOT EXISTS provider_waba_id text,
  ADD COLUMN IF NOT EXISTS provider_phone_id text;