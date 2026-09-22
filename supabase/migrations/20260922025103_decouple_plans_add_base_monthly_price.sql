/*
# Decouple subscription plans: add base_monthly_price for tier-based pricing
1. Modified Tables
- `subscription_plans` — add `base_monthly_price` (numeric, nullable) for independent tier/billing matrix
2. Data
- Set base_monthly_price per tier (Bronze=99, Prata=267, Ouro=435, Black=799)
- These are the per-month base prices; billing cycle discounts are computed at checkout
3. Security
- No new RLS needed
*/

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS base_monthly_price NUMERIC(10, 2) DEFAULT 0;

-- Set base monthly prices per tier
-- Bronze: 1 totem, 99/mo base
UPDATE subscription_plans SET base_monthly_price = 99.00 WHERE name = 'Plano Bronze';
-- Prata: 3 totens, 89/mo per-totem equivalent => 267/mo base
UPDATE subscription_plans SET base_monthly_price = 267.00 WHERE name = 'Plano Prata';
-- Ouro: 5 totens, 79/mo per-totem equivalent => 435/mo base
UPDATE subscription_plans SET base_monthly_price = 435.00 WHERE name = 'Plano Ouro';
-- Black: 10 totens, 69/mo per-totem equivalent => 690/mo base
UPDATE subscription_plans SET base_monthly_price = 690.00 WHERE name = 'Plano Black';

-- Add billing_cycle_discount column for SuperAdmin custom discounts per company
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS custom_discount NUMERIC(5, 2) DEFAULT 0;
