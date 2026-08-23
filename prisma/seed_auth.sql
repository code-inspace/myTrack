-- Improve handle_new_user trigger to support ON CONFLICT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email, name = EXCLUDED.name;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed demo user into auth.users
DO $$
DECLARE
    demo_uid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    DELETE FROM auth.identities WHERE user_id = demo_uid;
    DELETE FROM auth.users WHERE id = demo_uid OR email = 'demo@de.mo';

    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        demo_uid,
        'authenticated',
        'authenticated',
        'demo@de.mo',
        crypt('demo', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"Axel (Démo)"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        demo_uid,
        demo_uid,
        format('{"sub":"%s","email":"demo@de.mo"}', demo_uid)::jsonb,
        'email',
        demo_uid::text,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
END $$;
