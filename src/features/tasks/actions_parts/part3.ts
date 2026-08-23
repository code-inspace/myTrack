      : undefined;
    scheduleTaskPushNotification({
      userId: targetId,
      taskId: updatedTask.id,
      taskTitle: updatedTask.title,
      startTime: updatedTask.startTime,
      scheduledIso,
      reminderOffsetMinutes: updatedTask.reminderOffsetMinutes ?? 10,
      reminderTimes: updatedTask.reminderTimes || ["11:00", "18:00"],
      date: targetDate,
      category: updatedTask.category,
    }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
  }

  return updatedTask;
}

export async function updateDbTaskActive(taskId: string, isActive: boolean, userId?: string): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const nowIso = new Date().toISOString();

  try {
    if (isActive) {
      // Activate target task with started_at = now (without deactivating other parallel tasks)
      await supabase
        .from("tasks")
        .update({ is_active: true, started_at: nowIso, updated_at: nowIso })
        .eq("id", taskId);
    } else {
      // Stop target task
      await supabase
        .from("tasks")
        .update({ is_active: false, started_at: null, updated_at: nowIso })
        .eq("id", taskId);
    }
  } catch (err) {
    console.warn("Supabase updateDbTaskActive error:", err);
  }

  const tasks = getStoredTasks(targetId);
  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        isActive,
        startedAt: isActive ? nowIso : null,
        updatedAt: nowIso,
      };
    }
    return t;
  });
  saveStoredTasks(updated, targetId);
}

export async function updateDbTaskStartedAt(
  taskId: string,
  startedAtTime: string,
  userId?: string
): Promise<{ startedAt: string }> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const now = new Date();
  const [hours, minutes] = startedAtTime.split(":").map((v) => parseInt(v, 10) || 0);
  const newStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  const newStartedAtIso = newStartDate.toISOString();
  const nowIso = now.toISOString();
  const todayStr = getTodayDateString();

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const isRecurring = target?.recurrence && target.recurrence !== "ONCE";

  // Calculate new end time if current end time is before new start time
  let provisionalEndTime = target?.endTime;
  if (!provisionalEndTime) {
    const endH = (hours + 1) % 24;
    provisionalEndTime = `${String(endH).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const utcStartTime = convertLocalTimeToUtc(startedAtTime, todayStr);
  const utcProvisionalEndTime = convertLocalTimeToUtc(provisionalEndTime, todayStr);

  const currentOverrides = target?.dateOverrides || {};
  const updatedOverrides = {
    ...currentOverrides,
    [todayStr]: {
      ...(currentOverrides[todayStr] || {}),
      startTime: utcStartTime,
      endTime: utcProvisionalEndTime,
    },
  };

  const dbUpdates: any = {
    started_at: newStartedAtIso,
    updated_at: nowIso,
    date_overrides: updatedOverrides,
  };

  if (!isRecurring) {
    dbUpdates.start_time = utcStartTime;
    dbUpdates.end_time = utcProvisionalEndTime;
  }

  try {
    await supabase
      .from("tasks")
      .update(dbUpdates)
      .eq("id", taskId);
  } catch (err) {
    console.warn("Supabase updateDbTaskStartedAt error:", err);
  }

  // Update completions actualStartTime as well
  try {
    await supabase
      .from("task_completions")
      .update({
        actual_start_time: utcStartTime,
        scheduled_start_time: utcStartTime,
        updated_at: nowIso,
      })
      .eq("task_id", taskId)
      .eq("date", todayStr);
  } catch (err) {
    console.warn("Supabase updateDbTaskStartedAt completion error:", err);
  }

  const updated = tasks.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        startedAt: newStartedAtIso,
        startTime: !isRecurring ? startedAtTime : t.startTime,
        endTime: !isRecurring ? provisionalEndTime : t.endTime,
        dateOverrides: {
          ...currentOverrides,
          [todayStr]: {
            ...(currentOverrides[todayStr] || {}),
            startTime: startedAtTime,
            endTime: provisionalEndTime,
          },
        },
        updatedAt: nowIso,
      };
    }
    return t;
  });
  saveStoredTasks(updated, targetId);

  // Update localStorage completions too
  const completions = getStoredCompletions(targetId);
  const compIdx = completions.findIndex((c) => c.taskId === taskId && c.date === todayStr);
  if (compIdx >= 0) {
    const nextCompletions = [...completions];
    nextCompletions[compIdx] = {
      ...nextCompletions[compIdx],
      actualStartTime: startedAtTime,
      scheduledStartTime: startedAtTime,
      updatedAt: nowIso,
    };
    saveStoredCompletions(nextCompletions, targetId);
  }

  return { startedAt: newStartedAtIso };
}

/**
 * Updates schedule for a specific date (or globally).
 * If task is recurring and not applyToAll, saves to dateOverrides[date].
 */
export async function updateTaskSchedule({
  taskId,
  date,
  startTime,
  endTime,
  applyToAll = false,
  userId,
}: {
  taskId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  applyToAll?: boolean;
  userId?: string;
}): Promise<void> {
  const supabase = createClient();
  let targetId = userId;
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();