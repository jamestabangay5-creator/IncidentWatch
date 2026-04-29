-- Seed a default admin account if it does not exist yet.
DO $$
DECLARE
  admin_email text := 'admin@sentinelchain.local';
  admin_password text := 'Admin@12345';
  new_user_id uuid;
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE email = admin_email LIMIT 1;

  IF existing_id IS NULL THEN
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', 'System Administrator'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', admin_email),
      'email',
      new_user_id::text,
      now(), now(), now()
    );

    existing_id := new_user_id;
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (existing_id, 'System Administrator', admin_email)
  ON CONFLICT (id) DO NOTHING;

  -- Ensure admin role is assigned
  INSERT INTO public.user_roles (user_id, role)
  VALUES (existing_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;