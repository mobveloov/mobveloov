/*
# Add pending_pagamento status support and plan discount columns

1. Changes
- Add quarterly_discount_percent and annual_discount_percent columns to subscription_plans
- These allow editing discount % per plan per billing cycle
2. Notes
- Companies already have a status text column that accepts any value
- No schema change needed for pending_pagamento status (it's just a text value)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'quarterly_discount_percent') THEN
    ALTER TABLE subscription_plans ADD COLUMN quarterly_discount_percent numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'annual_discount_percent') THEN
    ALTER TABLE subscription_plans ADD COLUMN annual_discount_percent numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'semiannual_discount_percent') THEN
    ALTER TABLE subscription_plans ADD COLUMN semiannual_discount_percent numeric DEFAULT 0;
  END IF;
END $$;