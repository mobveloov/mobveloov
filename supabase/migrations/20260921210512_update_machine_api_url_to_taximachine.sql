/*
# Update default machine_api_url to taximachine.com.br

1. Modified Tables
- `company_credentials`: change default value of `machine_api_url` from
  'https://api.machine.global' to 'https://taximachine.com.br'.
2. Data Migration
- Update all existing rows with legacy URLs to the new endpoint.
*/

ALTER TABLE company_credentials
  ALTER COLUMN machine_api_url SET DEFAULT 'https://taximachine.com.br';

UPDATE company_credentials
SET machine_api_url = 'https://taximachine.com.br'
WHERE machine_api_url IN (
  'https://api.machine.global',
  'https://api.machine.app/v1',
  'https://machine.global',
  'https://api.machine.global/v1'
);
