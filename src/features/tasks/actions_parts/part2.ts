      const current = getStoredTasks(targetId);
      const updated = [created, ...current.filter((t) => t.id !== created.id)];
      saveStoredTasks(updated, targetId);

      if (created.enableReminders) {
        const scheduledIso = created.startTime
          ? createUtcIsoFromLocalDateTime(created.startTime, taskDate)
          : undefined;
        scheduleTaskPushNotification({
          userId: targetId,
          taskTitle: created.title,
          startTime: created.startTime,
          scheduledIso,
          reminderOffsetMinutes: created.reminderOffsetMinutes ?? 10,
          reminderTimes: created.reminderTimes || ["11:00", "18:00"],
          date: taskDate,
          category: created.category,
        }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
      }

      return created;
    }
    if (error) {
      console.warn("Supabase createDbTask fallback:", error);
    }
  } catch (err) {
    console.warn("Supabase createDbTask error fallback:", err);
  }

  // Local fallback
  const createdLocal: Task = {
    id: "task-" + Date.now(),
    userId: targetId,
    title: task.title,
    description: task.description || null,
    category: task.category || "General",
    startTime: task.startTime || null,
    endTime: task.endTime || null,
    recurrence: task.recurrence,
    recurrenceConfig: task.recurrenceConfig || null,
    dateOverrides: taskOverrides,
    trackingType: task.trackingType,
    targetValue: task.targetValue !== undefined ? task.targetValue : null,
    unit: task.unit || null,
    enableReminders: task.enableReminders !== undefined ? task.enableReminders : true,
    reminderOffsetMinutes: task.reminderOffsetMinutes !== undefined ? task.reminderOffsetMinutes : 10,
    reminderTimes: task.reminderTimes || ["11:00", "18:00"],
    isActive: false,
    startedAt: null,
    isArchived: false,
    createdAt: createdIso,
    updatedAt: new Date().toISOString(),
  };
  const current = getStoredTasks(targetId);
  const updated = [createdLocal, ...current];
  saveStoredTasks(updated, targetId);

  if (createdLocal.enableReminders) {
    const scheduledIso = createdLocal.startTime
      ? createUtcIsoFromLocalDateTime(createdLocal.startTime, taskDate)
      : undefined;
    scheduleTaskPushNotification({
      userId: targetId,
      taskTitle: createdLocal.title,
      startTime: createdLocal.startTime,
      scheduledIso,
      reminderOffsetMinutes: createdLocal.reminderOffsetMinutes ?? 10,
      reminderTimes: createdLocal.reminderTimes || ["11:00", "18:00"],
      date: taskDate,
      category: createdLocal.category,
    }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
  }

  return createdLocal;
}

export async function updateDbTask(
  taskId: string,
  updates: Partial<TaskFormValues>,
  userId?: string
): Promise<Task> {
  const supabase = createClient();
  let targetId: string = userId || "";
  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const tasks = getStoredTasks(targetId);
  const target = tasks.find((t) => t.id === taskId);
  const nowIso = new Date().toISOString();

  const currentOverrides = target?.dateOverrides || {};
  const newOverrides = {
    ...currentOverrides,
    ...(updates.enableReminders !== undefined ? { _enableReminders: updates.enableReminders } : {}),
    ...(updates.reminderOffsetMinutes !== undefined ? { _reminderOffsetMinutes: updates.reminderOffsetMinutes } : {}),
    ...(updates.reminderTimes !== undefined ? { _reminderTimes: updates.reminderTimes } : {}),
  };

  const dbUpdates: any = {
    updated_at: nowIso,
    date_overrides: newOverrides,
  };

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description || null;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime ? convertLocalTimeToUtc(updates.startTime, updates.date) : null;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime ? convertLocalTimeToUtc(updates.endTime, updates.date) : null;
  if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
  if (updates.recurrenceConfig !== undefined) dbUpdates.recurrence_config = updates.recurrenceConfig;
  if (updates.trackingType !== undefined) dbUpdates.tracking_type = updates.trackingType;
  if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit || null;
  if (updates.date !== undefined && (updates.recurrence === "ONCE" || target?.recurrence === "ONCE")) {
    dbUpdates.created_at = `${updates.date}T12:00:00.000Z`;
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .update(dbUpdates)
      .eq("id", taskId)
      .select()
      .single();

    if (!error && data) {
      const updated = mapDbTaskToModel(data);
      const nextList = tasks.map((t) => (t.id === taskId ? updated : t));
      saveStoredTasks(nextList, targetId);

      if (updated.enableReminders) {
        const targetDate = updates.date || getTodayDateString();
        const scheduledIso = updated.startTime
          ? createUtcIsoFromLocalDateTime(updated.startTime, targetDate)
          : undefined;
        scheduleTaskPushNotification({
          userId: targetId,
          taskId: updated.id,
          taskTitle: updated.title,
          startTime: updated.startTime,
          scheduledIso,
          replaceExisting: true,
          reminderOffsetMinutes: updated.reminderOffsetMinutes ?? 10,
          reminderTimes: updated.reminderTimes || ["11:00", "18:00"],
          date: targetDate,
          category: updated.category,
        }).catch((e) => console.warn("scheduleTaskPushNotification note:", e));
      }

      return updated;
    }
  } catch (err) {
    console.warn("Supabase updateDbTask error:", err);
  }

  // Local fallback
  const baseTask: Task = target || {
    id: taskId,
    userId: targetId,
    title: "Habitude",
    category: "General",
    recurrence: "ONCE",
    trackingType: "BOOLEAN",
    isActive: false,
    isArchived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updatedTask: Task = {
    ...baseTask,
    id: taskId,
    userId: targetId,
    title: updates.title !== undefined ? updates.title : baseTask.title,
    description: updates.description !== undefined ? (updates.description || null) : baseTask.description,
    category: updates.category !== undefined ? updates.category : baseTask.category,
    startTime: updates.startTime !== undefined ? (updates.startTime || null) : baseTask.startTime,
    endTime: updates.endTime !== undefined ? (updates.endTime || null) : baseTask.endTime,
    recurrence: updates.recurrence !== undefined ? updates.recurrence : baseTask.recurrence,
    recurrenceConfig: updates.recurrenceConfig !== undefined ? updates.recurrenceConfig : baseTask.recurrenceConfig,
    trackingType: updates.trackingType !== undefined ? updates.trackingType : baseTask.trackingType,
    targetValue: updates.targetValue !== undefined ? updates.targetValue : baseTask.targetValue,
    unit: updates.unit !== undefined ? (updates.unit || null) : baseTask.unit,
    dateOverrides: newOverrides,
    enableReminders: updates.enableReminders !== undefined ? updates.enableReminders : baseTask.enableReminders ?? true,
    reminderOffsetMinutes: updates.reminderOffsetMinutes !== undefined ? updates.reminderOffsetMinutes : baseTask.reminderOffsetMinutes ?? 10,
    reminderTimes: updates.reminderTimes !== undefined ? updates.reminderTimes : baseTask.reminderTimes || ["11:00", "18:00"],
    updatedAt: nowIso,
  };
  const nextList = target
    ? tasks.map((t) => (t.id === taskId ? updatedTask : t))
    : [updatedTask, ...tasks];
  saveStoredTasks(nextList, targetId);

  if (updatedTask.enableReminders) {
    const targetDate = updates.date || getTodayDateString();
    const scheduledIso = updatedTask.startTime
      ? createUtcIsoFromLocalDateTime(updatedTask.startTime, targetDate)