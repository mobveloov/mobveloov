/*
# Fix superadmin auth user login

The original migration may have created the auth user with a password hash
that GoTrue doesn't recognize, or the identities entry may be malformed.
This migration recreates the user cleanly with a fresh bcrypt hash and
ensures all required auth tables are consistent.

Credentials: contato@veloov.com / Dj@1988#
*/

DO $$
DECLARE
  v_user_id uuid;
  v_hash text;
BEGIN
  -- Generate a fresh bcrypt hash
  v_hash := extensions.crypt('Dj@1988#', extensions.gen_salt('bf'));

  -- Check if user exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'contato@veloov.com';

  IF v_user_id IS NOT NULL THEN
    -- Update existing user: fresh password, confirmed email, superadmin role
    UPDATE auth.users
    SET encrypted_password = v_hash,
        email_confirmed_at = now(),
        raw_app_meta_data = '{"role": "superadmin"}'::jsonb,
        raw_user_meta_data = '{}'::jsonb,
        last_sign_in_at = NULL,
        updated_at = now()
    WHERE id = v_user_id;

    -- Fix identities entry
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'contato@veloov.com'),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    -- Create new user
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      last_sign_in_at,
      aud,
      role,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'contato@veloov.com',
      v_hash,
      now(),
      '{"role": "superadmin"}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      NULL,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'contato@veloov.com'),
      'email',
      now(),
      now(),
      now()
    );
  END IF;
END $$;