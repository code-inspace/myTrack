-- ==========================================================
-- MyTrack Supabase PostgreSQL Schema & Row Level Security (RLS)
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Enums
DO $$ BEGIN
    CREATE TYPE "TrackingType" AS ENUM ('BOOLEAN', 'NUMBER', 'DURATION', 'QUANTITY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RecurrenceType" AS ENUM ('ONCE', 'DAILY', 'WEEKDAYS', 'WEEKLY', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Users Profile (synced with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General' NOT NULL,
    start_time TEXT,
    end_time TEXT,
    recurrence "RecurrenceType" DEFAULT 'DAILY' NOT NULL,
    recurrence_config JSONB,
    tracking_type "TrackingType" DEFAULT 'BOOLEAN' NOT NULL,
    target_value DOUBLE PRECISION,
    unit TEXT,
    is_active BOOLEAN DEFAULT false NOT NULL,
    is_archived BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Task Completions Table
CREATE TABLE IF NOT EXISTS public.task_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- Format YYYY-MM-DD
    completed BOOLEAN DEFAULT true NOT NULL,
    value DOUBLE PRECISION,
    duration INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_task_date UNIQUE(task_id, date)
);

-- 4. Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT true NOT NULL,
    morning_reminder BOOLEAN DEFAULT true NOT NULL,
    morning_reminder_time TEXT DEFAULT '08:00' NOT NULL,
    evening_recap BOOLEAN DEFAULT true NOT NULL,
    evening_recap_time TEXT DEFAULT '21:00' NOT NULL,
    streak_reminder BOOLEAN DEFAULT true NOT NULL,
    missed_task_reminder BOOLEAN DEFAULT true NOT NULL,
    onesignal_player_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Notification Schedules (Custom actionable reminders)
CREATE TABLE IF NOT EXISTS public.notification_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    time TEXT NOT NULL,
    days INTEGER[] DEFAULT '{1,2,3,4,5}' NOT NULL,
    enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Chat Conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'AI Coach Session' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    context_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view and edit own profile"
    ON public.users FOR ALL
    USING (auth.uid() = id);

-- Tasks policies
CREATE POLICY "Users can manage their own tasks"
    ON public.tasks FOR ALL
    USING (auth.uid() = user_id);

-- Task completions policies
CREATE POLICY "Users can manage their own completions"
    ON public.task_completions FOR ALL
    USING (auth.uid() = user_id);

-- Notification preferences policies
CREATE POLICY "Users can manage their own notification preferences"
    ON public.notification_preferences FOR ALL
    USING (auth.uid() = user_id);

-- Notification schedules policies
CREATE POLICY "Users can manage their own notification schedules"
    ON public.notification_schedules FOR ALL
    USING (auth.uid() = user_id);

-- Chat conversations policies
CREATE POLICY "Users can manage their own chat conversations"
    ON public.chat_conversations FOR ALL
    USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can manage messages within their own conversations"
    ON public.chat_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_conversations
            WHERE public.chat_conversations.id = public.chat_messages.conversation_id
            AND public.chat_conversations.user_id = auth.uid()
        )
    );

-- Trigger to create a public.user when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
