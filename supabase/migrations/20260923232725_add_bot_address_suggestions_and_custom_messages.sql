/*
# Add address suggestions table + custom messages column for bot connections

1. bot_address_suggestions — per-connection address shortcuts (nickname → real address)
2. bot_whatsapp_conexoes.bot_custom_messages — JSONB with customizable bot message texts
*/

CREATE TABLE IF NOT EXISTS bot_address_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES bot_whatsapp_conexoes(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  address_text text NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_address_suggestions_conn_idx ON bot_address_suggestions (connection_id);

ALTER TABLE bot_whatsapp_conexoes
  ADD COLUMN IF NOT EXISTS bot_custom_messages jsonb DEFAULT '{}';

ALTER TABLE bot_address_suggestions ENABLE ROW LEVEL SECURITY;
