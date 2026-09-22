/*
# Rename plans to Bronze/Prata/Ouro/Black + add message_tier column + canceled_timeout status
1. Modified Tables
- `subscription_plans` — add `message_tier` (text, default 'A')
- `rides` — add 'canceled_timeout' to status check constraint
2. Data
- Update existing plan names to Bronze/Prata/Ouro/Black
- Fix legacy 'searching' status to 'pending'
3. Security
- No new RLS needed
*/

-- Fix legacy status
UPDATE rides SET status = 'pending' WHERE status = 'searching';

-- Add message_tier to subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS message_tier TEXT DEFAULT 'A';

-- Update plan names and message tiers
UPDATE subscription_plans SET name = 'Plano Bronze', message_tier = 'A', totem_limit = 1, billing_period = 'monthly', price = 99.00 WHERE billing_period = 'monthly';
UPDATE subscription_plans SET name = 'Plano Prata', message_tier = 'B', totem_limit = 3, billing_period = 'quarterly', price = 249.00 WHERE billing_period = 'quarterly';
UPDATE subscription_plans SET name = 'Plano Ouro', message_tier = 'C', totem_limit = 5, billing_period = 'semiannual', price = 449.00 WHERE billing_period = 'semiannual';
UPDATE subscription_plans SET name = 'Plano Black', message_tier = 'C', totem_limit = 10, billing_period = 'annual', price = 799.00 WHERE billing_period = 'annual';

-- Update rides status constraint to include canceled_timeout
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_status_check CHECK (status IN ('pending','accepted','en_route','in_progress','completed','canceled','canceled_timeout'));
