/*
# Create superadmin auth user + test company with settings and categories

1. Purpose
   Seeds the platform with:
   - Superadmin auth user (contato@veloov.com / Dj@1988#) with role=superadmin in app_metadata
   - Test company "Hotel Central" (slug: hotel-central) with default settings and 3 vehicle categories

2. Security
   - Auth user gets app_metadata.role = 'superadmin' so RLS policies grant full access
   - Email is pre-confirmed so login works without email confirmation
   - Test company is active so anon/passenger access works
*/

-- Create superadmin auth user if not exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'contato@veloov.com';

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
      'contato@veloov.com',
      extensions.crypt('Dj@1988#', extensions.gen_salt('bf')),
      now(),
      '{"role": "superadmin"}'::jsonb,
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
      jsonb_build_object('sub', v_user_id::text, 'email', 'contato@veloov.com'),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    -- Ensure existing user has superadmin role and correct password
    UPDATE auth.users
    SET raw_app_meta_data = '{"role": "superadmin"}'::jsonb,
        encrypted_password = extensions.crypt('Dj@1988#', extensions.gen_salt('bf')),
        email_confirmed_at = now()
    WHERE id = v_user_id;
  END IF;
END $$;

-- Create test company "Hotel Central" if not exists
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE slug = 'hotel-central';

  IF v_company_id IS NULL THEN
    INSERT INTO companies (slug, name, status, brand_color)
    VALUES ('hotel-central', 'Hotel Central', 'active', '#D4AF37')
    RETURNING id INTO v_company_id;
  ELSE
    UPDATE companies SET status = 'active' WHERE id = v_company_id;
  END IF;

  -- Ensure company_settings exists
  INSERT INTO company_settings (company_id, base_fee, per_km_rate, per_min_rate, min_fee, surge_multiplier, integration_mode)
  VALUES (v_company_id, 5.00, 2.50, 0.50, 8.00, 1.00, 'manual')
  ON CONFLICT (company_id) DO UPDATE SET
    base_fee = 5.00,
    per_km_rate = 2.50,
    per_min_rate = 0.50,
    min_fee = 8.00,
    surge_multiplier = 1.00,
    integration_mode = 'manual';

  -- Ensure vehicle categories exist (3 default categories)
  INSERT INTO vehicle_categories (company_id, label, description, base_fee, per_km_rate, per_min_rate, min_fee, eta_minutes, sort_order, is_active)
  VALUES
    (v_company_id, 'Econômico', 'Veículo compacto, melhor preço', 5.00, 2.50, 0.50, 8.00, 5, 0, true),
    (v_company_id, 'Conforto', 'Veículo espaçoso, mais conforto', 7.00, 3.00, 0.70, 10.00, 7, 1, true),
    (v_company_id, 'Executivo', 'Veículo premium, alta qualidade', 10.00, 4.00, 1.00, 15.00, 10, 2, true)
  ON CONFLICT DO NOTHING;
END $$;
