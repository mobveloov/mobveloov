/*
# Add require_price_before_dispatch to company_settings

1. Modified Tables
- `company_settings`: adds `require_price_before_dispatch` boolean column (default false).
  When true, the "Solicitar" button on the category screen is disabled if the
  Machine API could not return a price estimate. When false (default), the
  passenger can still request a ride and the price is confirmed with the driver.

2. Security
- No RLS policy changes. Existing policies on company_settings remain unchanged.
*/

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS require_price_before_dispatch boolean NOT NULL DEFAULT false;
