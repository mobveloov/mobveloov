/*
# Add driver reference columns to bot_conversas and rides

1. New Columns on `bot_conversas`:
   - `origin_reference` (text) — the informal/apelido text the passenger typed for pickup (e.g. "Amarelinha da Avenida"), shown to the driver as a reference.
   - `destination_reference` (text) — the informal/apelido text the passenger typed for destination (e.g. "Prainha"), shown to the driver as a reference.

2. New Columns on `rides`:
   - `origin_reference` (text) — same as above, persisted on the ride record for dispatch.
   - `destination_reference` (text) — same as above, persisted on the ride record for dispatch.

3. Notes:
   - These columns allow the system to separate the geocodable address (used for the Machine API map) from the human-readable text the driver sees in their app.
   - When the destination is an informal place, `destination_label` / `destination_lat` / `destination_lng` can be null while `destination_reference` carries the display text — enabling KM-based taximeter pricing.
   - No RLS changes needed — existing policies cover the new columns automatically.
*/

ALTER TABLE bot_conversas
  ADD COLUMN IF NOT EXISTS origin_reference text,
  ADD COLUMN IF NOT EXISTS destination_reference text;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS origin_reference text,
  ADD COLUMN IF NOT EXISTS destination_reference text;