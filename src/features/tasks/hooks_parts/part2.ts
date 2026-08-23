      const nowTime = format(new Date(), "HH:mm");

      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: newStatus,
        value: value !== undefined ? value : existing?.value || null,
        duration: duration !== undefined ? duration : existing?.duration || null,
        scheduledStartTime: targetTask?.startTime || existing?.scheduledStartTime || null,
        scheduledEndTime: targetTask?.endTime || existing?.scheduledEndTime || null,
        actualStartTime: existing?.actualStartTime || (newStatus ? nowTime : null),
        actualEndTime: newStatus ? nowTime : null,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const startTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const nowTime = format(new Date(), "HH:mm");
      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const isRecurring = targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      // 1. Position task on the Agenda starting at now
      const provisionalEndTime = targetTask?.endTime || addHoursToTimeString(nowTime, 1);
      await updateTaskSchedule({
        taskId,
        date,
        startTime: nowTime,
        endTime: provisionalEndTime,
        applyToAll: !isRecurring,
        userId,
      });

      // 2. Set actual_start_time = now in completions
      const completions = getStoredCompletions(userId);
      const existing = completions.find((c) => c.taskId === taskId && c.date === date);
      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: existing?.completed || false,
        scheduledStartTime: nowTime,
        scheduledEndTime: provisionalEndTime,
        actualStartTime: nowTime,
        actualEndTime: existing?.actualEndTime || null,
      });

      // 3. Mark task active
      await updateDbTaskActive(taskId, true, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const finishTaskExecution = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const now = new Date();
      const nowTime = format(now, "HH:mm");
      const tasks = getStoredTasks(userId);
      const targetTask = tasks.find((t) => t.id === taskId);
      const isRecurring = targetTask?.recurrence && targetTask.recurrence !== "ONCE";

      let actualStart = nowTime;
      let durationMinutes = 1;

      if (targetTask?.startedAt) {
        const startDate = new Date(targetTask.startedAt);
        if (!isNaN(startDate.getTime())) {
          actualStart = format(startDate, "HH:mm");
          const diffMinutes = Math.round((now.getTime() - startDate.getTime()) / 60000);
          durationMinutes = Math.max(1, diffMinutes);
        }
      } else {
        const completions = getStoredCompletions(userId);
        const existing = completions.find((c) => c.taskId === taskId && c.date === date);
        if (existing?.actualStartTime) {
          actualStart = existing.actualStartTime;
        } else if (targetTask?.startTime) {
          actualStart = targetTask.startTime;
        }
      }

      // 1. Set task endTime to now on the Agenda
      await updateTaskSchedule({
        taskId,
        date,
        startTime: actualStart,
        endTime: nowTime,
        applyToAll: !isRecurring,
        userId,
      });

      // 2. Mark completed: true and actualEndTime: now in task_completions
      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: true,
        duration: durationMinutes,
        actualStartTime: actualStart,
        actualEndTime: nowTime,
        scheduledStartTime: actualStart,
        scheduledEndTime: nowTime,
      });

      // 3. Deactivate task
      await updateDbTaskActive(taskId, false, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const toggleTaskActive = useMutation({
    mutationFn: async (args: string | { taskId: string; date?: string }) => {
      const taskId = typeof args === "string" ? args : args.taskId;
      const date = typeof args === "string" ? getTodayDateString() : (args.date || getTodayDateString());

      const tasks = getStoredTasks(userId);
      const target = tasks.find((t) => t.id === taskId);
      const isCurrentlyActive = Boolean(target?.isActive);

      if (!isCurrentlyActive) {
        await startTaskExecution.mutateAsync({ taskId, date });
      } else {
        await finishTaskExecution.mutateAsync({ taskId, date });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const updateCompletionValue = useMutation({
    mutationFn: async ({
      taskId,
      date,
      value,
    }: {
      taskId: string;
      date: string;
      value: number;
    }) => {
      await upsertDbCompletion({
        taskId,
        userId,
        date,
        completed: true,
        value,
        duration: null,
        notes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({
      taskId,
      values,
    }: {
      taskId: string;
      values: Partial<TaskFormValues>;
    }) => {
      return updateDbTask(taskId, values, userId);
    },
    onMutate: async ({ taskId, values }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(["tasks", userId]);

      queryClient.setQueryData<Task[]>(["tasks", userId], (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            ...values,
            dateOverrides: {
              ...(t.dateOverrides || {}),
              ...(values.enableReminders !== undefined ? { _enableReminders: values.enableReminders } : {}),
            },
          };
        })
      );

      return { prevTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {