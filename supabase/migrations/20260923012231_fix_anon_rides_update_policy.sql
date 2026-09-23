/*
# Allow anon to update rides (cancel flow from totem)

1. Purpose
- The totem runs without login (anon role). When a passenger cancels a ride from the totem,
  the app updates the ride status to 'canceled'. The current UPDATE policy only allows
  authenticated users (company admins), so the totem gets a 403 error.

2. Security
- Adds a new anon UPDATE policy scoped to rides belonging to active companies.
- Only allows updating status-related columns; the policy does not allow changing company_id,
  driver info, or price — those are set by the dispatch board or Machine API webhook only.
- Column-level grants restrict anon UPDATE to just the status and updated_at columns.

3. Important notes
- The anon role can now set status='canceled' on any ride belonging to an active company.
  This is acceptable because the totem is a kiosk in public use — anyone at the kiosk can
  cancel the active ride, which is the intended UX.
- Column privileges ensure anon cannot modify driver_name, driver_phone, vehicle_plate,
  vehicle_model, estimated_price, or company_id.
*/

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Revoke full UPDATE from anon, then grant only the columns they need
REVOKE UPDATE ON public.rides FROM anon;
GRANT UPDATE (status, updated_at) ON public.rides TO anon;

DROP POLICY IF EXISTS "anon_update_ride_status" ON public.rides;
CREATE POLICY "anon_update_ride_status"
ON public.rides
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = rides.company_id
      AND c.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = rides.company_id
      AND c.status = 'active'
  )
);