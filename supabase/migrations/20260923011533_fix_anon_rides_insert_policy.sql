/*
# Allow public totem ride creation for active companies

1. Purpose
- Fixes the 403 error that prevented a visitor using the totem from creating a ride.
- The browser uses the anonymous Supabase role during the public ride-request flow.

2. Security
- Replaces the anonymous INSERT rule for `rides` with a rule that only accepts rows whose `company_id` belongs to an active company.
- Keeps the existing anonymous SELECT rule limited to rides belonging to active companies.
- Does not grant anonymous UPDATE or DELETE access to rides.

3. Important notes
- This is intentionally a public request flow: the totem does not require an account.
- The central service remains responsible for dispatching and updating rides through privileged server functions.
*/

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_rides" ON public.rides;
CREATE POLICY "anon_insert_rides"
ON public.rides
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = rides.company_id
      AND c.status = 'active'
  )
);