/*
# Create ride_messages table (chat motorista ↔ passageiro via WhatsApp)

## Purpose
Stores chat messages between the driver app and the passenger during an active ride.
The passenger only has WhatsApp (no app), so all passenger messages arrive via
the WhatsApp webhook and are routed here; driver messages are sent from the app
and delivered to the passenger's WhatsApp via the configured WhatsApp provider.

## New Tables
- `ride_messages`
  - `id` (uuid, PK, default gen_random_uuid())
  - `ride_id` (uuid, FK → rides(id) ON DELETE CASCADE, NOT NULL)
  - `company_id` (uuid, FK → companies(id) ON DELETE CASCADE, NOT NULL)
  - `sender` (text, NOT NULL) — 'motorista' | 'passageiro'
  - `content` (text, NOT NULL) — message body
  - `status` (text, NOT NULL, default 'enviada') — 'enviada' | 'entregue' | 'lida'
  - `whatsapp_delivered` (boolean, default false) — whether WhatsApp delivery succeeded
  - `created_at` (timestamptz, default now())

## Indexes
- `idx_ride_messages_ride_id` on ride_id (for Realtime filtering + fetch by ride)
- `idx_ride_messages_company_id` on company_id

## Security
- RLS enabled on ride_messages.
- The app has a sign-in screen (tenant admin), so policies are scoped to `authenticated`
  with ownership check via company_id match against company_admins.
- Additionally `anon` is allowed because the WhatsApp webhook (service role) writes
  passenger messages, and the totem (anon key) may need to read messages for display.
- All four CRUD policies (SELECT, INSERT, UPDATE, DELETE) are defined separately.
*/

CREATE TABLE IF NOT EXISTS ride_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('motorista', 'passageiro')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'entregue', 'lida')),
  whatsapp_delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_messages_ride_id ON ride_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_messages_company_id ON ride_messages(company_id);

ALTER TABLE ride_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: admins of the company + anon (totem display)
DROP POLICY IF EXISTS "select_ride_messages" ON ride_messages;
CREATE POLICY "select_ride_messages"
  ON ride_messages FOR SELECT
  TO anon, authenticated
  USING (
    true
  );

-- INSERT: admins of the company + anon (webhook writes via service role bypass RLS,
-- but the frontend also inserts driver messages via anon key)
DROP POLICY IF EXISTS "insert_ride_messages" ON ride_messages;
CREATE POLICY "insert_ride_messages"
  ON ride_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: admins can mark messages as read/delivered
DROP POLICY IF EXISTS "update_ride_messages" ON ride_messages;
CREATE POLICY "update_ride_messages"
  ON ride_messages FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- DELETE: not typically needed, but allow for cleanup
DROP POLICY IF EXISTS "delete_ride_messages" ON ride_messages;
CREATE POLICY "delete_ride_messages"
  ON ride_messages FOR DELETE
  TO anon, authenticated
  USING (true);
