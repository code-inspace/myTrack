CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Alter all default UUID columns to built-in gen_random_uuid()
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.tasks ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.task_completions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.notification_preferences ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.notification_schedules ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.chat_conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.chat_messages ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Recreate handle_new_user with full resilience and error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Insert into public.users
  INSERT INTO public.users (id, email, name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email, 
      name = COALESCE(EXCLUDED.name, public.users.name),
      updated_at = NOW();

  -- 2. Insert into notification_preferences
  INSERT INTO public.notification_preferences (
    id,
    user_id,
    push_enabled,
    morning_reminder,
    morning_reminder_time,
    evening_recap,
    evening_recap_time,
    streak_reminder,
    missed_task_reminder
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    true,
    true,
    '08:00',
    true,
    '21:00',
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Create default chat conversation
  INSERT INTO public.chat_conversations (
    id,
    user_id,
    title
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    'Conversation avec le Coach MyTrack'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user exception: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
