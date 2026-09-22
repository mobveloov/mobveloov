/*
# Create Hotel Central tenant admin login

Creates an auth user (admin@hotelcentral.com / Hotel@2026) and links it
to the Hotel Central company via company_admins so the tenant admin panel works.
*/

DO $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
BEGIN
  -- Get the Hotel Central company
  SELECT id INTO v_company_id FROM companies WHERE slug = 'hotel-central';
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company hotel-central not found';
  END IF;

  -- Check if admin user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@hotelcentral.com';

  IF v_user_id IS NULL THEN
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
      'admin@hotelcentral.com',
      extensions.crypt('Hotel@2026', extensions.gen_salt('bf')),
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      now(),
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
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@hotelcentral.com'),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    -- Ensure password is correct if user exists
    UPDATE auth.users
    SET encrypted_password = extensions.crypt('Hotel@2026', extensions.gen_salt('bf')),
        email_confirmed_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Link user to company as admin (if not already linked)
  INSERT INTO company_admins (user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'admin')
  ON CONFLICT (user_id, company_id) DO NOTHING;
END $$;
