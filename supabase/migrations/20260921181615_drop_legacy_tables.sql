/*
# Drop legacy single-tenant tables before multi-tenant migration

1. Purpose
   The previous single-tenant schema (passenger_sessions, ride_orders, payment_transactions,
   admin_logs, pricing_settings, vip_tiers, admin_config) conflicts with the new multi-tenant
   schema. This migration drops all legacy tables to make way for the new multi-tenant structure.

2. Tables Dropped
   - payment_transactions (had FK to ride_orders)
   - ride_orders (had FK to passenger_sessions)
   - passenger_sessions
   - admin_logs (old structure without company_id)
   - pricing_settings
   - vip_tiers
   - admin_config

3. Security
   - All RLS policies on these tables are dropped automatically when the tables are dropped.

4. Important Notes
   - ride_orders has 6397 rows — these are test data from the previous single-tenant app
     and are NOT user data (this is a development project being rebuilt from scratch).
   - Dropping is required because the old admin_logs table lacks company_id column,
     causing a conflict with the new admin_logs table definition.
   - Order matters: child tables (payment_transactions) dropped before parent (ride_orders).
*/

DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS ride_orders CASCADE;
DROP TABLE IF EXISTS passenger_sessions CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS pricing_settings CASCADE;
DROP TABLE IF EXISTS vip_tiers CASCADE;
DROP TABLE IF EXISTS admin_config CASCADE;

-- Drop old functions that reference dropped tables
DROP FUNCTION IF EXISTS check_admin_password(text);
DROP FUNCTION IF EXISTS admin_has_password();
DROP FUNCTION IF EXISTS set_admin_password(text, text);