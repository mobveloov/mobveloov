/*
# Prevent duplicate WhatsApp event processing

1. New Tables
- `whatsapp_processed_events`
- `id` (uuid, primary key)
- `company_id` (uuid, tenant identifier)
- `event_id` (text, Evolution/WhatsApp message identifier)
- `processed_at` (timestamptz, processing claim time)

2. Data Integrity
- A unique constraint on `(company_id, event_id)` ensures the same incoming message is claimed only once, even when the webhook is delivered repeatedly or reaches multiple configured instances for the same company.
- This table stores only event identifiers and timestamps, never message content or media.

3. Security
- Row Level Security is enabled.
- Browser roles cannot read, insert, update, or delete processing markers.
- The webhook uses the Supabase service role, which is intentionally required for this internal coordination table.

4. Important Notes
- Existing rides, messages, conversations, and webhook data are not modified or deleted.
- Duplicate deliveries are acknowledged by the webhook without running the bot flow again.
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_processed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_processed_events_company_event_key UNIQUE (company_id, event_id)
);

ALTER TABLE public.whatsapp_processed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_select_whatsapp_processed_events" ON public.whatsapp_processed_events;
CREATE POLICY "deny_select_whatsapp_processed_events"
  ON public.whatsapp_processed_events FOR SELECT
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "deny_insert_whatsapp_processed_events" ON public.whatsapp_processed_events;
CREATE POLICY "deny_insert_whatsapp_processed_events"
  ON public.whatsapp_processed_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_update_whatsapp_processed_events" ON public.whatsapp_processed_events;
CREATE POLICY "deny_update_whatsapp_processed_events"
  ON public.whatsapp_processed_events FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_delete_whatsapp_processed_events" ON public.whatsapp_processed_events;
CREATE POLICY "deny_delete_whatsapp_processed_events"
  ON public.whatsapp_processed_events FOR DELETE
  TO anon, authenticated
  USING (false);

CREATE INDEX IF NOT EXISTS whatsapp_processed_events_processed_at_idx
  ON public.whatsapp_processed_events (processed_at);
