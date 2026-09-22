/*
# Add Taxímetro credentials to company_credentials

1. Modified Tables
- `company_credentials`: add `taximetro_username` (text) and `taximetro_password` (text) columns
  for Basic Auth authentication against the taximachine.com.br integration endpoint.
2. Security
- No RLS policy changes — existing company_credentials policies already govern access.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credentials' AND column_name = 'taximetro_username'
  ) THEN
    ALTER TABLE company_credentials ADD COLUMN taximetro_username text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_credentials' AND column_name = 'taximetro_password'
  ) THEN
    ALTER TABLE company_credentials ADD COLUMN taximetro_password text;
  END IF;
END $$;
