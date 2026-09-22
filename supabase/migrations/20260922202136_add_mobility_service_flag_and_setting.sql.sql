/*
# Add mobility service flag to companies and seed mobility municipalServiceId

1. Modified Tables
- `companies` — add `has_mobility_service` (boolean, default false) to mark companies that contracted the optional urban mobility service.

2. Data
- Insert a `system_settings` row `asaas_mobility_service_id` (text) where the Asaas municipalServiceId for the urban mobility service will be stored. This is configurable by the superadmin via the system settings panel.

3. Security
- No new policies needed — `has_mobility_service` is covered by existing company RLS policies.
*/

ALTER TABLE companies ADD COLUMN IF NOT EXISTS has_mobility_service boolean NOT NULL DEFAULT false;

INSERT INTO system_settings (key_name, key_value)
VALUES ('asaas_mobility_service_id', '')
ON CONFLICT (key_name) DO NOTHING;
