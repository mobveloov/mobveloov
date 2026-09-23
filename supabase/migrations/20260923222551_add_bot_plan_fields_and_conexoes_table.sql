/*
# Add bot plan fields + create bot_whatsapp_conexoes table

1. New Columns on subscription_plans
- bot_incluso (boolean, default false) — whether the plan includes the WhatsApp ride bot
- limite_conexoes_bot (integer, default 0) — max bot WhatsApp connections allowed

2. Plan Configuration
- Black: bot_incluso = true, limite_conexoes_bot = 10
- Diamante: bot_incluso = true, limite_conexoes_bot = 50
- All other plans: bot_incluso = false, limite_conexoes_bot = 0

3. New Table: bot_whatsapp_conexoes
- Separate from whatsapp_instances — this is for the bot's own WhatsApp connections
- id (uuid, PK)
- company_id (uuid, FK to companies)
- instance_name (text) — Evolution API instance name for this bot connection
- phone_number (text) — the WhatsApp number connected
- connection_status (text) — connected/disconnected/connecting
- qr_code (text) — QR code for pairing (cleared after connection)
- evolution_api_url (text) — Evolution API base URL
- evolution_global_token (text) — Evolution API global token
- created_at, updated_at (timestamptz)

4. Security
- RLS enabled on bot_whatsapp_conexoes, no anon policies (managed via edge functions with service role key)
*/

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS bot_incluso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limite_conexoes_bot integer NOT NULL DEFAULT 0;

UPDATE subscription_plans
  SET bot_incluso = true, limite_conexoes_bot = 10
  WHERE name = 'Plano Black';

UPDATE subscription_plans
  SET bot_incluso = true, limite_conexoes_bot = 50
  WHERE name = 'Plano Diamante';

CREATE TABLE IF NOT EXISTS bot_whatsapp_conexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  phone_number text,
  connection_status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  evolution_api_url text,
  evolution_global_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_whatsapp_conexoes_company_idx ON bot_whatsapp_conexoes (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS bot_whatsapp_conexoes_instance_idx ON bot_whatsapp_conexoes (instance_name);

ALTER TABLE bot_whatsapp_conexoes ENABLE ROW LEVEL SECURITY;
