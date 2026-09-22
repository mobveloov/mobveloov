/*
# Add simulation_mode to company_settings

1. Modified Tables
- `company_settings` — add `simulation_mode` (boolean, default false) to persist the simulation toggle
2. Security
- Existing RLS on company_settings already covers the new column
*/

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS simulation_mode BOOLEAN NOT NULL DEFAULT false;
