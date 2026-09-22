/*
# Add B2B registration columns to companies

1. Modified Tables
- `companies` — add `cnpj`, `responsible_name`, `responsible_phone`, `responsible_email`, `asaas_customer_id`, `asaas_payment_id`, `asaas_checkout_url`
2. Security
- Existing RLS on companies already covers new columns
*/

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS responsible_name TEXT,
  ADD COLUMN IF NOT EXISTS responsible_phone TEXT,
  ADD COLUMN IF NOT EXISTS responsible_email TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_checkout_url TEXT;
