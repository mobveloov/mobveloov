/*
# Allow anon SELECT on companies for totem public flow

1. Purpose
- The totem public flow looks up company details by slug to render the request screen.
- Without an anon SELECT policy on `companies`, only authenticated sessions can read it, causing the public totem to fail.

2. Security
- Limits anon access to active companies only (status = 'active').
- No writes granted.

3. Important notes
- The companies table may contain columns that should not be public. This policy only exposes rows; column-level grants remain unchanged.
*/

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_active_companies" ON public.companies;
CREATE POLICY "anon_select_active_companies"
ON public.companies
FOR SELECT
TO anon, authenticated
USING (status = 'active');