UPDATE company_credentials
SET machine_api_url = 'https://api.taximachine.com.br'
WHERE company_id = (SELECT id FROM companies WHERE slug = 'hotel-central');
