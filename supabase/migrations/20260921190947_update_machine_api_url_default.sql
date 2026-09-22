/*
# Update Machine API default URL to machine.global

1. Changes the default value on company_credentials.machine_api_url
2. Updates existing rows that still have the old default
*/

-- Update the column default
ALTER TABLE company_credentials
  ALTER COLUMN machine_api_url SET DEFAULT 'https://machine.global';

-- Update existing rows that were using the old default URL
UPDATE company_credentials
  SET machine_api_url = 'https://machine.global',
      updated_at = now()
  WHERE machine_api_url = 'https://api.machine.app/v1'
     OR machine_api_url IS NULL;
