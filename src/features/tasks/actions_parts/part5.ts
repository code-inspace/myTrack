      scheduledStartTime: completion.scheduledStartTime !== undefined ? completion.scheduledStartTime : updated[existingIdx].scheduledStartTime,
      scheduledEndTime: completion.scheduledEndTime !== undefined ? completion.scheduledEndTime : updated[existingIdx].scheduledEndTime,
      actualStartTime: completion.actualStartTime !== undefined ? completion.actualStartTime : updated[existingIdx].actualStartTime,
      actualEndTime: completion.actualEndTime !== undefined ? completion.actualEndTime : updated[existingIdx].actualEndTime,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const newRecord: TaskCompletion = {
      ...completion,
      id: "comp-" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updated = [newRecord, ...completions];
  }

  saveStoredCompletions(updated, targetId);
}

export function saveStoredCompletions(completions: TaskCompletion[], userId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = getEffectiveUserId(userId);
  const key = COMPLETIONS_STORAGE_PREFIX + targetId;
  localStorage.setItem(key, JSON.stringify(completions));
}
