/*
# Restore the working Machine API URL

1. Plain-English change
- Restores the Machine API base URL used by the v2 dispatch integration to `https://api.taximachine.com.br`.
- Repairs company credential rows that are empty or still contain the incorrect `api.machine.global` value.

2. Modified table
- `company_credentials`
- Changes the default value of `machine_api_url`.
- Updates only null values and known legacy/incorrect Machine API URLs.

3. Data safety
- Custom URLs for other providers are preserved.
- No rows, columns, credentials, or ride data are deleted.

4. Notes
- The URL is only the API base address. Existing API keys and taximeter credentials are not changed.
*/

ALTER TABLE public.company_credentials
  ALTER COLUMN machine_api_url SET DEFAULT 'https://api.taximachine.com.br';

UPDATE public.company_credentials
SET machine_api_url = 'https://api.taximachine.com.br',
    updated_at = now()
WHERE machine_api_url IS NULL
   OR machine_api_url IN (
     'https://api.machine.global',
     'https://machine.global',
     'https://api.machine.app/v1',
     'https://taximachine.com.br'
   );