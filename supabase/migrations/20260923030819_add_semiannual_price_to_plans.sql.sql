/*
# Add semiannual_price column to subscription_plans

1. Changes
- Adds `semiannual_price` numeric column to `subscription_plans` table, defaulting to 0.
- This completes the billing cycle set: monthly, quarterly, semiannual, annual.

2. Notes
- Non-destructive: only adds a column with a safe default.
- Existing plans get semiannual_price = 0; the frontend will auto-calculate it as
  base_monthly_price * 6 * (1 - semiannual_discount_percent/100) when the stored value is 0.
*/

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS semiannual_price numeric DEFAULT 0;
