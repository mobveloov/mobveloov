/*
# Auto-calculate plan prices from base_monthly_price with default discounts

1. Changes
- Updates all subscription_plans with auto-calculated quarterly, semiannual, and annual prices.
- Formula: base_monthly_price * months * (1 - discount_percent/100)
- Default discounts: quarterly 5%, semiannual 10%, annual 15%
- Also sets the discount_percent columns so the superadmin panel displays them.

2. Notes
- Non-destructive: only updates price columns and discount percentages.
- The frontend form will auto-calculate these values whenever base_monthly_price changes,
  so the superadmin never needs to set them manually.
*/

UPDATE subscription_plans SET
  quarterly_discount_percent = 5,
  semiannual_discount_percent = 10,
  annual_discount_percent = 15,
  quarterly_price = ROUND(base_monthly_price * 3 * (1 - 0.05), 2),
  semiannual_price = ROUND(base_monthly_price * 6 * (1 - 0.10), 2),
  annual_price = ROUND(base_monthly_price * 12 * (1 - 0.15), 2),
  updated_at = now();
