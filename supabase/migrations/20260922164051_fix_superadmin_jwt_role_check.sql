/*
# Fix superadmin RLS policies — JWT role check

## Problem
All superadmin-scoped RLS policies used `auth.jwt() ->> 'role'` which returns
the PostgreSQL database role ("authenticated"), NOT the custom "superadmin"
value stored in `app_metadata.role`. This caused every superadmin policy to
silently evaluate to false, making the SuperAdmin panel unable to see any
companies, drivers, rides, settings, etc.

## Fix
Replace `auth.jwt() ->> 'role'` with `auth.jwt() -> 'app_metadata' ->> 'role'`
in all 42 affected policies across 12 tables:
- companies
- company_admins
- company_settings
- company_credentials
- rides
- whatsapp_instances
- admin_logs
- vehicle_categories
- drivers
- tenant_secrets
- company_locations
- system_settings

## Security
No structural changes to policies — only the JWT path is corrected.
All ownership checks, company_admins membership checks, and role gating
remain identical in logic.
*/

DROP POLICY IF EXISTS "select_companies" ON companies;
CREATE POLICY "select_companies" ON companies FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = companies.id)));

DROP POLICY IF EXISTS "insert_companies_superadmin" ON companies;
CREATE POLICY "insert_companies_superadmin" ON companies FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);

DROP POLICY IF EXISTS "update_companies_superadmin" ON companies;
CREATE POLICY "update_companies_superadmin" ON companies FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);

DROP POLICY IF EXISTS "delete_companies_superadmin" ON companies;
CREATE POLICY "delete_companies_superadmin" ON companies FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);

DROP POLICY IF EXISTS "select_own_company_admins" ON company_admins;
CREATE POLICY "select_own_company_admins" ON company_admins FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text));

DROP POLICY IF EXISTS "insert_own_company_admins" ON company_admins;
CREATE POLICY "insert_own_company_admins" ON company_admins FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text));

DROP POLICY IF EXISTS "delete_company_admins" ON company_admins;
CREATE POLICY "delete_company_admins" ON company_admins FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text));

DROP POLICY IF EXISTS "select_company_settings" ON company_settings;
CREATE POLICY "select_company_settings" ON company_settings FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)));

DROP POLICY IF EXISTS "insert_company_settings" ON company_settings;
CREATE POLICY "insert_company_settings" ON company_settings FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)));

DROP POLICY IF EXISTS "update_company_settings" ON company_settings;
CREATE POLICY "update_company_settings" ON company_settings FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_settings.company_id)));

DROP POLICY IF EXISTS "select_company_credentials" ON company_credentials;
CREATE POLICY "select_company_credentials" ON company_credentials FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)));

DROP POLICY IF EXISTS "insert_company_credentials" ON company_credentials;
CREATE POLICY "insert_company_credentials" ON company_credentials FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)));

DROP POLICY IF EXISTS "update_company_credentials" ON company_credentials;
CREATE POLICY "update_company_credentials" ON company_credentials FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_credentials.company_id)));

DROP POLICY IF EXISTS "select_rides" ON rides;
CREATE POLICY "select_rides" ON rides FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = rides.company_id)));

DROP POLICY IF EXISTS "update_rides" ON rides;
CREATE POLICY "update_rides" ON rides FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = rides.company_id)));

DROP POLICY IF EXISTS "select_whatsapp_instances" ON whatsapp_instances;
CREATE POLICY "select_whatsapp_instances" ON whatsapp_instances FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)));

DROP POLICY IF EXISTS "insert_whatsapp_instances" ON whatsapp_instances;
CREATE POLICY "insert_whatsapp_instances" ON whatsapp_instances FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)));

DROP POLICY IF EXISTS "update_whatsapp_instances" ON whatsapp_instances;
CREATE POLICY "update_whatsapp_instances" ON whatsapp_instances FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_instances.company_id)));

DROP POLICY IF EXISTS "select_admin_logs" ON admin_logs;
CREATE POLICY "select_admin_logs" ON admin_logs FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = admin_logs.company_id)));

DROP POLICY IF EXISTS "insert_admin_logs" ON admin_logs;
CREATE POLICY "insert_admin_logs" ON admin_logs FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = admin_logs.company_id)));

DROP POLICY IF EXISTS "delete_admin_logs" ON admin_logs;
CREATE POLICY "delete_admin_logs" ON admin_logs FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = admin_logs.company_id)));

DROP POLICY IF EXISTS "select_vehicle_categories" ON vehicle_categories;
CREATE POLICY "select_vehicle_categories" ON vehicle_categories FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)));

DROP POLICY IF EXISTS "insert_vehicle_categories" ON vehicle_categories;
CREATE POLICY "insert_vehicle_categories" ON vehicle_categories FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)));

DROP POLICY IF EXISTS "update_vehicle_categories" ON vehicle_categories;
CREATE POLICY "update_vehicle_categories" ON vehicle_categories FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)));

DROP POLICY IF EXISTS "delete_vehicle_categories" ON vehicle_categories;
CREATE POLICY "delete_vehicle_categories" ON vehicle_categories FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = vehicle_categories.company_id)));

DROP POLICY IF EXISTS "select_drivers" ON drivers;
CREATE POLICY "select_drivers" ON drivers FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)));

DROP POLICY IF EXISTS "insert_drivers" ON drivers;
CREATE POLICY "insert_drivers" ON drivers FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)));

DROP POLICY IF EXISTS "update_drivers" ON drivers;
CREATE POLICY "update_drivers" ON drivers FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)));

DROP POLICY IF EXISTS "delete_drivers" ON drivers;
CREATE POLICY "delete_drivers" ON drivers FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = drivers.company_id)));

DROP POLICY IF EXISTS "select_tenant_secrets" ON tenant_secrets;
CREATE POLICY "select_tenant_secrets" ON tenant_secrets FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id)));

DROP POLICY IF EXISTS "insert_tenant_secrets" ON tenant_secrets;
CREATE POLICY "insert_tenant_secrets" ON tenant_secrets FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id)));

DROP POLICY IF EXISTS "update_tenant_secrets" ON tenant_secrets;
CREATE POLICY "update_tenant_secrets" ON tenant_secrets FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id)));

DROP POLICY IF EXISTS "delete_tenant_secrets" ON tenant_secrets;
CREATE POLICY "delete_tenant_secrets" ON tenant_secrets FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = tenant_secrets.tenant_id)));

DROP POLICY IF EXISTS "select_company_locations" ON company_locations;
CREATE POLICY "select_company_locations" ON company_locations FOR SELECT TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)));

DROP POLICY IF EXISTS "insert_company_locations" ON company_locations;
CREATE POLICY "insert_company_locations" ON company_locations FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)));

DROP POLICY IF EXISTS "update_company_locations" ON company_locations;
CREATE POLICY "update_company_locations" ON company_locations FOR UPDATE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)));

DROP POLICY IF EXISTS "delete_company_locations" ON company_locations;
CREATE POLICY "delete_company_locations" ON company_locations FOR DELETE TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
    OR (EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = company_locations.company_id)));

DROP POLICY IF EXISTS "select_system_settings" ON system_settings;
CREATE POLICY "select_system_settings" ON system_settings FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);

DROP POLICY IF EXISTS "insert_system_settings" ON system_settings;
CREATE POLICY "insert_system_settings" ON system_settings FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);

DROP POLICY IF EXISTS "update_system_settings" ON system_settings;
CREATE POLICY "update_system_settings" ON system_settings FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);

DROP POLICY IF EXISTS "delete_system_settings" ON system_settings;
CREATE POLICY "delete_system_settings" ON system_settings FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role'::text) = 'superadmin'::text);
