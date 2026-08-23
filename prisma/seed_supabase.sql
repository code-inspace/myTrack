-- Update public.users to allow both Supabase Auth users and seeded users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Seed Demo Data into Supabase
DO $$
DECLARE
    demo_user_id UUID := '00000000-0000-0000-0000-000000000001';
    task_1_id UUID := '00000000-0000-0000-0000-000000000011';
    task_2_id UUID := '00000000-0000-0000-0000-000000000012';
    task_3_id UUID := '00000000-0000-0000-0000-000000000013';
    task_4_id UUID := '00000000-0000-0000-0000-000000000014';
BEGIN
    -- 1. Insert Demo User in public.users if not exists
    INSERT INTO public.users (id, email, name, avatar_url, timezone)
    VALUES (demo_user_id, 'demo@de.mo', 'Axel (Démo)', NULL, 'Europe/Paris')
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email, name = EXCLUDED.name;

    -- 2. Notification Preferences
    INSERT INTO public.notification_preferences (user_id, push_enabled, morning_reminder, evening_recap, streak_reminder)
    VALUES (demo_user_id, true, true, true, true)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Insert Demo Tasks
    INSERT INTO public.tasks (id, user_id, title, description, category, start_time, end_time, recurrence, tracking_type, target_value, unit, is_active)
    VALUES 
    (task_1_id, demo_user_id, 'Entraînement matinal', 'Étirements et circuit au poids du corps', 'Fitness', '05:30', '06:00', 'DAILY', 'DURATION', 30, 'min', true),
    (task_2_id, demo_user_id, 'Pompes', 'Séries quotidiennes pectoraux & bras', 'Fitness', '05:30', '06:00', 'DAILY', 'NUMBER', 50, 'reps', false),
    (task_3_id, demo_user_id, 'Lecture', 'Atomic Habits & System design', 'Learning', '05:30', '06:00', 'DAILY', 'NUMBER', 20, 'pages', false),
    (task_4_id, demo_user_id, 'Session Deep Work', 'Programmation ciblée sans distractions', 'Productivity', '05:30', '06:00', 'DAILY', 'DURATION', 120, 'min', false)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Insert Completions
    INSERT INTO public.task_completions (task_id, user_id, date, completed, value, duration)
    VALUES
    (task_2_id, demo_user_id, TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'), true, 35, NULL),
    (task_2_id, demo_user_id, TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'), true, 50, NULL),
    (task_2_id, demo_user_id, TO_CHAR(CURRENT_DATE - INTERVAL '2 days', 'YYYY-MM-DD'), true, 50, NULL),
    (task_2_id, demo_user_id, TO_CHAR(CURRENT_DATE - INTERVAL '3 days', 'YYYY-MM-DD'), true, 50, NULL),
    (task_1_id, demo_user_id, TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'), true, NULL, 1800),
    (task_3_id, demo_user_id, TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'), true, 20, NULL)
    ON CONFLICT (task_id, date) DO NOTHING;

    -- 5. Notification Schedules
    INSERT INTO public.notification_schedules (user_id, task_id, question, time, days, enabled)
    VALUES
    (demo_user_id, task_2_id, 'As-tu fait tes pompes aujourd''hui ?', '18:00', '{1,2,3,4,5}', true),
    (demo_user_id, task_3_id, 'As-tu lu ton chapitre du jour ?', '20:30', '{1,2,3,4,5,6,0}', true)
    ON CONFLICT DO NOTHING;

    -- 6. Chat Welcome
    INSERT INTO public.chat_conversations (id, user_id, title)
    VALUES ('00000000-0000-0000-0000-000000000101', demo_user_id, 'Session Coach IA')
    ON CONFLICT (id) DO NOTHING;

END $$;
