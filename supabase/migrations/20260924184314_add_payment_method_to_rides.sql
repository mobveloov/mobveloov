/*
# Add payment_method column to rides

1. Changes
- Adds `payment_method` text column to `rides` table (nullable for backward compatibility).
  Values: "Dinheiro", "Pix", "Cartao" or null.
2. Notes
- No RLS changes needed — existing policies already cover the column.
*/

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS payment_method text;
