-- Add message limit column for bot plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS limite_mensagens_bot integer DEFAULT 0;

-- Set sensible defaults: Diamante = unlimited (NULL), Black = 500, others = 0
UPDATE subscription_plans SET limite_mensagens_bot = CASE
  WHEN name ILIKE '%diamante%' THEN NULL
  WHEN name ILIKE '%black%' THEN 500
  ELSE 0
END;

-- Add comment for clarity
COMMENT ON COLUMN subscription_plans.limite_mensagens_bot IS 'Monthly message limit for bot WhatsApp. NULL = unlimited (Diamante). 0 = bot not available.';
