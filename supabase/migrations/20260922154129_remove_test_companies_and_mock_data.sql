/*
# Remove test companies and mock data

1. Purpose
   Removes the two test-seeded companies and all their associated data:
   - "Hotel Central" (slug: hotel-central) — created by the test migration
     `create_superadmin_and_test_company` with 14 test rides, 1 category, 1 location
   - "UP Corridas" (slug: upcorridas) — empty company with no admin and no data

   The superadmin auth user (contato@veloov.com) is the real platform owner and is KEPT.
   The Hotel Central test admin auth user (admin@hotelcentral.com) cannot be deleted
   from auth.users via this tool (no permission to manage auth users), but the
   company_admins link is removed so it is orphaned and harmless.

2. What gets deleted
   - All rides belonging to these two companies
   - All vehicle_categories, company_settings, company_locations, passengers,
     invoices, support_tickets for these companies (via ON DELETE CASCADE or explicit delete)
   - company_admins links for these companies
   - The company records themselves

3. What is kept
   - Superadmin auth user (contato@veloov.com) — real platform owner
   - Subscription plans, system settings, veloov_whatsapp_config — platform-level data
   - All schema (tables, policies, indexes) — unchanged
*/

-- Delete rides explicitly (may not have ON DELETE CASCADE)
DELETE FROM rides WHERE company_id IN (
  'ea28797a-09f8-4f36-ae10-276b3149f13c',  -- Hotel Central
  '7b8ab2e5-2a6f-45b0-8da9-d9fd2a28c327'   -- UP Corridas
);

-- Delete company_admins links (removes admin association)
DELETE FROM company_admins WHERE company_id IN (
  'ea28797a-09f8-4f36-ae10-276b3149f13c',
  '7b8ab2e5-2a6f-45b0-8da9-d9fd2a28c327'
);

-- Delete the companies themselves (ON DELETE CASCADE handles settings, categories, locations, etc.)
DELETE FROM companies WHERE id IN (
  'ea28797a-09f8-4f36-ae10-276b3149f13c',
  '7b8ab2e5-2a6f-45b0-8da9-d9fd2a28c327'
);
