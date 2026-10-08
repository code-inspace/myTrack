-- ==========================================================
-- Read-only check that the database matches what the app expects
-- (migrations 0001 → 0008). Paste in the Supabase SQL Editor and Run.
-- Every row should have ok = true; failures are listed first.
-- ==========================================================

WITH cols AS (
  SELECT table_name, column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
expected_columns(table_name, column_name) AS (
  VALUES
    ('tasks', 'sort_order'), ('tasks', 'project_id'), ('tasks', 'project_status'),
    ('tasks', 'project_category'), ('tasks', 'deadline'), ('tasks', 'priority'),
    ('tasks', 'date_overrides'), ('tasks', 'is_active'), ('tasks', 'started_at'),
    ('projects', 'columns'), ('projects', 'categories'),
    ('sleep_logs', 'naps'), ('sleep_logs', 'bedtime_validated'), ('sleep_logs', 'wake_time_validated'),
    ('task_completions', 'scheduled_start_time'), ('task_completions', 'scheduled_end_time'),
    ('task_completions', 'actual_start_time'), ('task_completions', 'actual_end_time'),
    ('task_completions', 'duration'),
    ('calendar_subscriptions', 'url'), ('calendar_subscriptions', 'username'),
    ('calendar_subscriptions', 'password')
),
rls_tables(table_name) AS (
  VALUES ('tasks'), ('task_completions'), ('projects'), ('sleep_logs'),
         ('calendar_subscriptions'), ('reminders'), ('notification_preferences')
),
checks AS (
  -- 1. Columns used by the app exist
  SELECT 'colonne ' || e.table_name || '.' || e.column_name AS verification,
         'présente' AS attendu,
         CASE WHEN c.column_name IS NULL THEN 'absente' ELSE 'présente' END AS actuel
  FROM expected_columns e
  LEFT JOIN cols c USING (table_name, column_name)

  UNION ALL
  -- 2. Defaults aligned by migration 0008
  SELECT 'défaut tasks.recurrence', '''ONCE''',
         coalesce((SELECT split_part(column_default, '::', 1) FROM cols
                   WHERE table_name = 'tasks' AND column_name = 'recurrence'), 'aucun')
  UNION ALL
  SELECT 'défaut sleep_logs.bedtime', 'aucun',
         coalesce((SELECT column_default FROM cols
                   WHERE table_name = 'sleep_logs' AND column_name = 'bedtime'), 'aucun')
  UNION ALL
  SELECT 'défaut sleep_logs.wake_time', 'aucun',
         coalesce((SELECT column_default FROM cols
                   WHERE table_name = 'sleep_logs' AND column_name = 'wake_time'), 'aucun')
  UNION ALL
  SELECT 'défaut calendar_subscriptions.color', '''#3B82F6''',
         coalesce((SELECT split_part(column_default, '::', 1) FROM cols
                   WHERE table_name = 'calendar_subscriptions' AND column_name = 'color'), 'aucun')
  UNION ALL
  -- 3. Calendar subscription ids are app-generated text ("cal-...")
  SELECT 'type calendar_subscriptions.id', 'text',
         coalesce((SELECT data_type FROM cols
                   WHERE table_name = 'calendar_subscriptions' AND column_name = 'id'), 'absente')

  UNION ALL
  -- 4. Unique keys the upserts rely on (onConflict)
  SELECT 'unique task_completions(task_id, date)', 'présente',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND tablename = 'task_completions'
             AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(task_id, date)%'
         ) THEN 'présente' ELSE 'absente' END
  UNION ALL
  SELECT 'unique sleep_logs(user_id, date)', 'présente',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND tablename = 'sleep_logs'
             AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(user_id, date)%'
         ) THEN 'présente' ELSE 'absente' END

  UNION ALL
  -- 5. Row Level Security on and at least one policy per user table
  SELECT 'RLS activée sur ' || r.table_name, 'oui',
         CASE WHEN coalesce(pc.relrowsecurity, false) THEN 'oui' ELSE 'non' END
  FROM rls_tables r
  LEFT JOIN pg_class pc ON pc.relname = r.table_name
    AND pc.relnamespace = 'public'::regnamespace
  UNION ALL
  SELECT 'policy sur ' || r.table_name, '≥ 1',
         CASE WHEN count(p.policyname) > 0 THEN '≥ 1' ELSE '0' END
  FROM rls_tables r
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = r.table_name
  GROUP BY r.table_name

  UNION ALL
  -- 6. No recorded sleep in the future (future days only hold the objective)
  SELECT 'sommeil enregistré dans le futur', '0',
         (SELECT count(*)::text FROM public.sleep_logs WHERE date > to_char(now(), 'YYYY-MM-DD'))
)
SELECT verification, attendu, actuel, attendu = actuel AS ok
FROM checks
ORDER BY ok, verification;
