ALTER TABLE bot_conversas
  ADD COLUMN IF NOT EXISTS selected_payment_method text;
