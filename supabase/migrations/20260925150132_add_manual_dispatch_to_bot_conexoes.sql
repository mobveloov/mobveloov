/*
# Add manual dispatch toggle to bot_whatsapp_conexoes

1. Changes
- Adds `manual_dispatch_enabled` (boolean, default false) to `bot_whatsapp_conexoes`.
  When true, the company's support WhatsApp number can send formatted messages
  to the bot number to manually create and dispatch rides on behalf of passengers.

2. Notes
- No RLS changes needed — existing policies on bot_whatsapp_conexoes already cover SELECT/UPDATE.
- The toggle is per-connection, so each bot instance can enable/disable independently.
*/

ALTER TABLE bot_whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS manual_dispatch_enabled boolean NOT NULL DEFAULT false;
