/*
# Make destination fields nullable on rides table

Allows the totem to create rides without a destination. The passenger
may not know the address or have difficulty typing it — the driver/central
sets the destination later and the price is calculated at the end of the ride.

1. Modified Tables
- `rides`: `destination_label`, `destination_lat`, `destination_lng` become nullable.
  `estimated_price` already has a default of 0, so no change needed there.

2. Security
- No policy changes needed. Existing RLS policies already cover these columns.

3. Notes
- When destination is null, the Machine API call omits the `desejado` object
  (which is optional per the API spec). The price is set to 0 and the
  `final_price` is filled later by the webhook when the ride completes.
*/

ALTER TABLE rides
  ALTER COLUMN destination_label DROP NOT NULL,
  ALTER COLUMN destination_lat DROP NOT NULL,
  ALTER COLUMN destination_lng DROP NOT NULL;
