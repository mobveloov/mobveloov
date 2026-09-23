-- Fix search_path mutable warning on increment_chat_unread
CREATE OR REPLACE FUNCTION public.increment_chat_unread(chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_chats
  SET unread_count = unread_count + 1
  WHERE id = chat_id;
END;
$$;

-- Revoke execution from anon and authenticated — only the service role (edge functions) should call this
REVOKE EXECUTE ON FUNCTION public.increment_chat_unread(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_chat_unread(uuid) TO service_role;
