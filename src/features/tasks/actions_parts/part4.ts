    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const nowIso = new Date().toISOString();

  const isRecurring = target?.recurrence && target.recurrence !== "ONCE";
  const utcStart = startTime ? convertLocalTimeToUtc(startTime, date) : null;
  const utcEnd = endTime ? convertLocalTimeToUtc(endTime, date) : null;

  if (isRecurring && !applyToAll) {
    // Specific day override
    const currentOverrides = target?.dateOverrides || {};
    const updatedOverrides = {
      ...currentOverrides,
      [date]: { startTime: utcStart, endTime: utcEnd },
    };

    try {
      await supabase
        .from("tasks")
        .update({ date_overrides: updatedOverrides, updated_at: nowIso })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule override error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            dateOverrides: {
              ...currentOverrides,
              [date]: { startTime, endTime },
            },
            updatedAt: nowIso,
          }
        : t
    );
    saveStoredTasks(updated, targetId);
  } else {
    // Global schedule update
    try {
      await supabase
        .from("tasks")
        .update({ start_time: utcStart, end_time: utcEnd, updated_at: nowIso })
        .eq("id", taskId);
    } catch (err) {
      console.warn("Supabase updateTaskSchedule global error:", err);
    }

    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, startTime, endTime, updatedAt: nowIso } : t
    );
    saveStoredTasks(updated, targetId);
  }
}

export async function deleteDbTask(taskId: string, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    await supabase.from("tasks").delete().eq("id", taskId);
  } catch (err) {
    console.warn("Supabase deleteDbTask error:", err);
  }

  const tasks = getStoredTasks(targetId);
  const updated = tasks.filter((t) => t.id !== taskId);
  saveStoredTasks(updated, targetId);
}

export function saveStoredTasks(tasks: Task[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = TASKS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(tasks));
}

export async function fetchCompletions(userId?: string): Promise<TaskCompletion[]> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  try {
    const { data, error } = await supabase
      .from("task_completions")
      .select("*")
      .eq("user_id", targetId);

    if (!error && data) {
      const mapped = data.map(mapDbCompletionToModel);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchCompletions error:", err);
  }

  return getStoredCompletions(targetId);
}

export function getStoredCompletions(userId?: string): TaskCompletion[] {
  const targetId = getEffectiveUserId(userId);
  const isDemo = targetId === DEMO_USER.id;
  if (typeof window === "undefined") return isDemo ? generateDemoSeedCompletions() : [];
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;

  const stored = localStorage.getItem(key);
  if (!stored) {
    if (isDemo) {
      const seed = generateDemoSeedCompletions(targetId);
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0 && isDemo) {
        const seed = generateDemoSeedCompletions(targetId);
        localStorage.setItem(key, JSON.stringify(seed));
        return seed;
      }
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export async function upsertDbCompletion(
  completion: Omit<TaskCompletion, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<void> {
  const supabase = createClient();
  let targetId = completion.userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    await supabase.from("task_completions").upsert(
      [
        {
          task_id: completion.taskId,
          user_id: targetId,
          date: completion.date,
          completed: completion.completed,
          value: completion.value,
          duration: completion.duration,
          notes: completion.notes,
          scheduled_start_time: completion.scheduledStartTime
            ? convertLocalTimeToUtc(completion.scheduledStartTime, completion.date)
            : null,
          scheduled_end_time: completion.scheduledEndTime
            ? convertLocalTimeToUtc(completion.scheduledEndTime, completion.date)
            : null,
          actual_start_time: completion.actualStartTime
            ? convertLocalTimeToUtc(completion.actualStartTime, completion.date)
            : null,
          actual_end_time: completion.actualEndTime
            ? convertLocalTimeToUtc(completion.actualEndTime, completion.date)
            : null,
        },
      ],
      { onConflict: "task_id,date" }
    );
  } catch (err) {
    console.warn("Supabase upsertDbCompletion error:", err);
  }

  const completions = getStoredCompletions(targetId);
  const existingIdx = completions.findIndex(
    (c) => c.taskId === completion.taskId && c.date === completion.date
  );

  let updated: TaskCompletion[];
  if (existingIdx >= 0) {
    updated = [...completions];
    updated[existingIdx] = {
      ...updated[existingIdx],
      completed: completion.completed,
      value: completion.value !== undefined ? completion.value : updated[existingIdx].value,
      duration: completion.duration !== undefined ? completion.duration : updated[existingIdx].duration,