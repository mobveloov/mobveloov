-- Add column to store pending fuzzy street match options on bot_conversas.
-- When the bot finds multiple streets that fuzzy-match the passenger's input,
-- it stores the options here as JSONB so the next webhook invocation can
-- retrieve them when the passenger replies with their choice.

ALTER TABLE bot_conversas ADD COLUMN IF NOT EXISTS pending_fuzzy_options JSONB;