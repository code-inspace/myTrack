-- Enable RLS on all public tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view and edit own profile" ON public.users;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage their own completions" ON public.task_completions;
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can manage their own notification schedules" ON public.notification_schedules;
DROP POLICY IF EXISTS "Users can manage their own chat conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can manage messages within their own conversations" ON public.chat_messages;

-- 1. Users policies (Read & Write own profile + Demo user public read)
CREATE POLICY "Users can manage own profile"
  ON public.users
  FOR ALL
  USING (auth.uid() = id OR id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (auth.uid() = id OR id = '00000000-0000-0000-0000-000000000001');

-- 2. Tasks policies
CREATE POLICY "Users can manage own tasks"
  ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- 3. Task Completions policies
CREATE POLICY "Users can manage own completions"
  ON public.task_completions
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- 4. Notification Preferences policies
CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- 5. Notification Schedules policies
CREATE POLICY "Users can manage own notification schedules"
  ON public.notification_schedules
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- 6. Chat Conversations policies
CREATE POLICY "Users can manage own chat conversations"
  ON public.chat_conversations
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- 7. Chat Messages policies
CREATE POLICY "Users can manage own chat messages"
  ON public.chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE public.chat_conversations.id = public.chat_messages.conversation_id
      AND (public.chat_conversations.user_id = auth.uid() OR public.chat_conversations.user_id = '00000000-0000-0000-0000-000000000001')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE public.chat_conversations.id = public.chat_messages.conversation_id
      AND (public.chat_conversations.user_id = auth.uid() OR public.chat_conversations.user_id = '00000000-0000-0000-0000-000000000001')
    )
  );
