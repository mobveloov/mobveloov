/*
# Add quarterly and annual price columns to subscription_plans

1. Modified Tables
- `subscription_plans`: add `quarterly_price` (numeric, default 0) and `annual_price` (numeric, default 0)
  - These allow the SuperAdmin plans matrix to edit quarterly and annual billing alongside monthly
2. Security
- No RLS changes — existing policies remain unchanged
3. Important Notes
- Columns are nullable-safe with default 0 so existing rows are unaffected
*/

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS quarterly_price numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_price numeric(10,2) DEFAULT 0;
