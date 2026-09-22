-- Table for the global Veloov WhatsApp (Evolution API) instance
-- This is managed by the superadmin and used by the "veloov" provider
CREATE TABLE IF NOT EXISTS veloov_whatsapp_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  evolution_api_url TEXT NOT NULL,
  evolution_global_token TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  last_connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO veloov_whatsapp_config (id, evolution_api_url, evolution_global_token, instance_name)
VALUES (1, '', '', 'veloov')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE veloov_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_veloov_whatsapp_superadmin" ON veloov_whatsapp_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "update_veloov_whatsapp_superadmin" ON veloov_whatsapp_config
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "insert_veloov_whatsapp_superadmin" ON veloov_whatsapp_config
  FOR INSERT TO authenticated WITH CHECK (true);
