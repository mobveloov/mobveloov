/*
# Add final_price column to rides table

1. Changes
- Add `final_price` (numeric, nullable) to `rides` table.
  - This stores the real/final price returned by the Machine API when a ride completes.
  - For rides priced by km where the passenger doesn't enter a destination, the
    estimated_price stays as the totem's estimate, and final_price captures the
    actual amount charged by the Machine at the end of the ride.
  - For fixed-price rides, final_price may equal estimated_price or differ if the
    Machine applies tariff adjustments.
2. Security
- No RLS policy changes needed — the column inherits the table's existing policies.
*/

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS final_price numeric;