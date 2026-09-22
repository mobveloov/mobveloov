/*
# Add company_id and admin_email to admin_logs for device audit trail

1. Modified Tables
- `admin_logs`: adds `company_id` (nullable FK to companies) and `admin_email` (text)
  so device bind/clear events can be attributed to a specific admin and company.

2. Security
- No RLS policy changes. Existing policies remain unchanged.
*/

ALTER TABLE admin_logs
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_email text;

CREATE INDEX IF NOT EXISTS idx_admin_logs_company ON admin_logs(company_id);
