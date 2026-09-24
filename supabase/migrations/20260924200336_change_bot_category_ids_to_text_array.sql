/*
# Change bot_category_ids from uuid[] to text[]

## Why
The Machine API returns category IDs as numeric strings (e.g. "47093"),
which are not valid UUIDs. The bot_category_ids column was defined as uuid[],
causing "invalid input syntax for type uuid" errors when saving Machine API
category selections from the bot panel.

## Changes
1. Alter bot_whatsapp_conexoes.bot_category_ids from uuid[] to text[]
   using a safe cast that preserves any existing data (NULLs stay NULL,
   empty arrays stay empty, valid UUIDs become text).

## Security
No RLS or policy changes — only the column type changes.
*/

ALTER TABLE bot_whatsapp_conexoes
  ALTER COLUMN bot_category_ids TYPE text[]
  USING bot_category_ids::text[];
