UPDATE company_credentials
SET machine_api_url = 'https://app.upcorridas.com.br'
WHERE company_id = (SELECT id FROM companies WHERE slug = 'hotel-central');
