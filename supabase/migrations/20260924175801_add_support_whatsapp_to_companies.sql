-- Add support WhatsApp number to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS support_whatsapp text;
COMMENT ON COLUMN companies.support_whatsapp IS 'WhatsApp number for passenger support requests forwarded from the bot.';
