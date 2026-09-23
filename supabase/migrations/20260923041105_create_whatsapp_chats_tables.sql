/*
# Create WhatsApp chats and messages tables

1. New Tables
- `whatsapp_chats`: represents a conversation with a single phone number.
  - id (uuid PK)
  - company_id (FK companies)
  - phone (text, not null) — normalized digits
  - contact_name (text) — display name if known (passenger name)
  - last_message_preview (text)
  - last_message_at (timestamptz)
  - unread_count (int, default 0)
  - created_at, updated_at
- `whatsapp_messages`: individual messages within a chat.
  - id (uuid PK)
  - chat_id (FK whatsapp_chats, cascade)
  - company_id (FK companies, cascade)
  - direction ('incoming' | 'outgoing')
  - phone (text)
  - body (text)
  - message_type (text, default 'text')
  - raw_payload (jsonb) — full Evolution API payload for debugging
  - sent_at (timestamptz)
  - created_at

2. Security
- RLS enabled on both tables.
- SELECT for authenticated tenant admins (own company only) and superadmin.
- INSERT for authenticated tenant admins and superadmin.
- UPDATE for authenticated (mark as read, update preview).
- DELETE for authenticated + superadmin.

3. Indexes
- whatsapp_chats(company_id, last_message_at DESC)
- whatsapp_messages(chat_id, sent_at DESC)
- whatsapp_messages(company_id)
*/

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  contact_name text,
  last_message_preview text,
  last_message_at timestamptz DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, phone)
);

ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_whatsapp_chats" ON whatsapp_chats;
CREATE POLICY "select_own_whatsapp_chats" ON whatsapp_chats FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_chats.company_id)
  );

DROP POLICY IF EXISTS "insert_own_whatsapp_chats" ON whatsapp_chats;
CREATE POLICY "insert_own_whatsapp_chats" ON whatsapp_chats FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_chats.company_id)
  );

DROP POLICY IF EXISTS "update_own_whatsapp_chats" ON whatsapp_chats;
CREATE POLICY "update_own_whatsapp_chats" ON whatsapp_chats FOR UPDATE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_chats.company_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_chats.company_id)
  );

DROP POLICY IF EXISTS "delete_own_whatsapp_chats" ON whatsapp_chats;
CREATE POLICY "delete_own_whatsapp_chats" ON whatsapp_chats FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_chats.company_id)
  );

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'incoming',
  phone text NOT NULL,
  body text,
  message_type text NOT NULL DEFAULT 'text',
  raw_payload jsonb,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "select_own_whatsapp_messages" ON whatsapp_messages FOR SELECT
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_messages.company_id)
  );

DROP POLICY IF EXISTS "insert_own_whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "insert_own_whatsapp_messages" ON whatsapp_messages FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_messages.company_id)
  );

DROP POLICY IF EXISTS "delete_own_whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "delete_own_whatsapp_messages" ON whatsapp_messages FOR DELETE
  TO authenticated USING (
    (auth.jwt() ->> 'role') = 'superadmin'
    OR EXISTS (SELECT 1 FROM company_admins ca WHERE ca.user_id = auth.uid() AND ca.company_id = whatsapp_messages.company_id)
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_company_latest
  ON whatsapp_chats(company_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_sent
  ON whatsapp_messages(chat_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company
  ON whatsapp_messages(company_id);
