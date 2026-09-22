/*
# Update Machine API base URL to api.machine.global

1. Changes the default value on company_credentials.machine_api_url
2. Updates existing rows to the new enterprise REST gateway endpoint
*/

ALTER TABLE company_credentials
  ALTER COLUMN machine_api_url SET DEFAULT 'https://api.machine.global';

UPDATE company_credentials
  SET machine_api_url = 'https://api.machine.global',
      updated_at = now()
  WHERE machine_api_url IN ('https://machine.global', 'https://api.machine.app/v1')
     OR machine_api_url IS NULL;
