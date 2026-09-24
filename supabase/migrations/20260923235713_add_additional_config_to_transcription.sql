/*
# Add additional_config column to bot_transcription_config

1. Modified Tables
- `bot_transcription_config`: add `additional_config` (jsonb, default '{}') to store
  per-provider extra credentials (e.g. region for Azure, project for Google).
2. Security
- No policy changes — existing RLS already covers the new column.
*/

ALTER TABLE bot_transcription_config
  ADD COLUMN IF NOT EXISTS additional_config jsonb NOT NULL DEFAULT '{}'::jsonb;
