/*
# Fix admin password functions — qualify crypt/gen_salt with extensions schema

1. Purpose
   The previous migration created set_admin_password and check_admin_password
   with `SET search_path = public`. The pgcrypto functions crypt() and gen_salt()
   live in the `extensions` schema, not `public`, so the unqualified calls fail
   with "function gen_salt(unknown) does not exist". This migration recreates
   all three functions with explicit `extensions.` schema prefixes.

2. Modified Functions
   - check_admin_password: uses extensions.crypt
   - admin_has_password: unchanged (no pgcrypto calls)
   - set_admin_password: uses extensions.crypt and extensions.gen_salt

3. Security
   - All functions remain SECURITY DEFINER SET search_path = public
   - EXECUTE granted to anon, authenticated (kiosk runs as anon)
   - admin_config table still has RLS with no policies (inaccessible via data API)

4. Important Notes
   - This is safe to re-run (CREATE OR REPLACE)
   - No data is lost; existing password hashes remain intact
*/

CREATE OR REPLACE FUNCTION check_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM admin_config LIMIT 1;
  IF v_hash IS NULL THEN
    RETURN true;
  END IF;
  RETURN v_hash = extensions.crypt(p_password, v_hash);
END;
$$;

REVOKE EXECUTE ON FUNCTION check_admin_password FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION check_admin_password TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_has_password()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM admin_config LIMIT 1;
  RETURN v_hash IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_has_password FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_has_password TO anon, authenticated;

CREATE OR REPLACE FUNCTION set_admin_password(p_new_password text, p_old_password text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_existing text;
BEGIN
  IF length(p_new_password) < 4 THEN
    RAISE EXCEPTION 'Password must be at least 4 characters';
  END IF;

  SELECT password_hash INTO v_existing FROM admin_config LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF p_old_password IS NULL OR v_existing != extensions.crypt(p_old_password, v_existing) THEN
      RETURN false;
    END IF;
    UPDATE admin_config SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now();
  ELSE
    INSERT INTO admin_config (password_hash) VALUES (extensions.crypt(p_new_password, extensions.gen_salt('bf')));
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_admin_password FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION set_admin_password TO anon, authenticated;