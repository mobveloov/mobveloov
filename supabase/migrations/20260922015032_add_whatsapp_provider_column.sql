-- Add whatsapp_provider column to support multiple WhatsApp API providers
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT NOT NULL DEFAULT 'evolution';

-- Add provider-specific fields
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider_token TEXT,
  ADD COLUMN IF NOT EXISTS provider_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_waba_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_api_url TEXT;

COMMENT ON COLUMN whatsapp_instances.whatsapp_provider IS 'Which WhatsApp API provider: evolution, zapi, meta_cloud, veloov';
