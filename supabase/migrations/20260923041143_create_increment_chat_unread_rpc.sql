/*
# Create increment_chat_unread RPC function

1. New Functions
- `increment_chat_unread(chat_id uuid)`: atomically increments unread_count on whatsapp_chats.
  Used by the webhook edge function (service role bypasses RLS).

2. Security
- SECURITY DEFINER so the edge function can call it via RPC.
- No sensitive data exposed.
*/

CREATE OR REPLACE FUNCTION increment_chat_unread(chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE whatsapp_chats
  SET unread_count = unread_count + 1,
      updated_at = now()
  WHERE id = chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_chat_unread(uuid) TO authenticated;
