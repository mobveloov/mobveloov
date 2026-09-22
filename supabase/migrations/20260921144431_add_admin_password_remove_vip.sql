/*
# Admin password protection + remove VIP tiers

1. Purpose
   Adds a password gate for the admin panel so only authorized operators can access
   pricing settings and logs from the kiosk. Removes VIP tier logic since the kiosk
   only intermediates rides — the driver pays fees directly in their own app.

2. New Tables
   - admin_config: stores a single bcrypt password hash for admin access

3. New Functions
   - check_admin_password(p_password): SECURITY DEFINER, verifies password against hash
   - set_admin_password(p_new, p_old): SECURITY DEFINER, sets or changes the password
   - admin_has_password(): SECURITY DEFINER, returns true if a password is configured

4. Security
   - admin_config has RLS enabled with NO policies — the table is completely
     inaccessible via the data API. Only the SECURITY DEFINER functions can read/write it.
   - Functions use pgcrypto crypt()/gen_salt('bf') for bcrypt hashing.
   - EXECUTE granted to anon, authenticated (the kiosk runs as anon).

5. Important Notes
   - On first use, no password exists. The app shows a "set password" screen.
   - After setting, the admin must enter the password to access settings.
   - To change the password, the old password is required.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- No policies = no direct access via data API. Only SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION check_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM admin_config LIMIT 1;
  IF v_hash IS NULL THEN
    RETURN true;
  END IF;
  RETURN v_hash = crypt(p_password, v_hash);
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
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing text;
BEGIN
  IF length(p_new_password) < 4 THEN
    RAISE EXCEPTION 'Password must be at least 4 characters';
  END IF;

  SELECT password_hash INTO v_existing FROM admin_config LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF p_old_password IS NULL OR v_existing != crypt(p_old_password, v_existing) THEN
      RETURN false;
    END IF;
    UPDATE admin_config SET password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now();
  ELSE
    INSERT INTO admin_config (password_hash) VALUES (crypt(p_new_password, gen_salt('bf')));
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_admin_password FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION set_admin_password TO anon, authenticated;