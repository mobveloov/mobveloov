/*
# Create bot_conversas table for WhatsApp ride-request bot

1. New Tables
- `bot_conversas` — tracks the state machine of each WhatsApp conversation
  that uses the bot to request a ride without human intervention.
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK to companies.id) — which company this conversation belongs to
  - `phone` (text) — passenger's WhatsApp number (digits only, with 55 prefix)
  - `passenger_name` (text) — name extracted from WhatsApp pushName
  - `state` (text) — current conversation state: inicio, aguardando_endereco, aguardando_confirmacao, corrida_solicitada
  - `address_text` (text) — raw address text typed/spoken by passenger
  - `address_lat` (double precision) — geocoded latitude
  - `address_lng` (double precision) — geocoded longitude
  - `address_formatted` (text) — formatted address from geocoder
  - `address_is_fallback` (boolean) — true when geocoding failed and we used city center as fallback
  - `ride_id` (uuid) — FK to rides.id once the ride is created
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `bot_conversas`.
- The table is managed exclusively by the whatsapp-webhook edge function
  using the service role key, so no anon/authenticated policies are needed.
  RLS is enabled and locked down (no policies = no access via anon key).
*/

CREATE TABLE IF NOT EXISTS bot_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  passenger_name text,
  state text NOT NULL DEFAULT 'inicio',
  address_text text,
  address_lat double precision,
  address_lng double precision,
  address_formatted text,
  address_is_fallback boolean NOT NULL DEFAULT false,
  ride_id uuid REFERENCES rides(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bot_conversas_company_phone_active_idx
  ON bot_conversas (company_id, phone)
  WHERE state != 'corrida_solicitada';

CREATE INDEX IF NOT EXISTS bot_conversas_state_idx ON bot_conversas (state);

ALTER TABLE bot_conversas ENABLE ROW LEVEL SECURITY;
