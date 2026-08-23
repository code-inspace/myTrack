          current_action_days: prefs.currentActionDays,
        },
      ],
      { onConflict: "user_id" }
    );
  } catch (err) {
    console.warn("Supabase updateDbPreferences fallback:", err);
  }
  saveStoredPreferences(prefs);

  // Schedule Morning & Evening routines via OneSignal
  if (prefs.pushEnabled && !prefs.allDisabled) {
    if (prefs.morningReminder && prefs.morningReminderTime) {
      scheduleTaskPushNotification({
        userId: targetId,
        taskTitle: "☀️ Objectifs du jour",
        startTime: prefs.morningReminderTime,
        type: "morning_routine",
        customMessage: "Ta journée MyTrack commence ! Découvre tes habitudes au programme.",
      }).catch(() => {});
    }

    if (prefs.eveningRecap && prefs.eveningRecapTime) {
      scheduleTaskPushNotification({
        userId: targetId,
        taskTitle: "🌙 Bilan de ta journée",
        startTime: prefs.eveningRecapTime,
        type: "evening_recap",
        customMessage: "C'est l'heure de faire le bilan de tes accomplissements du jour !",
      }).catch(() => {});
    }
  }
}

export function saveStoredPreferences(prefs: NotificationPreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

export function handleInteractiveNotificationResponse(
  taskId: string,
  response: { action: "YES" | "NO" | "QUANTITY"; value?: number }
): { success: boolean; message: string } {
  const date = getTodayDateString();
  const completions = getStoredCompletions();
  const index = completions.findIndex((c) => c.taskId === taskId && c.date === date);

  const completed = response.action === "YES" || response.action === "QUANTITY";
  const val = response.action === "QUANTITY" ? response.value : undefined;

  let updated = [...completions];
  if (index >= 0) {
    updated[index] = {
      ...updated[index],
      completed,
      value: val !== undefined ? val : updated[index].value,
      updatedAt: new Date().toISOString(),
    };
  } else {
    updated = [
      {
        id: "comp-" + Date.now(),
        taskId,
        userId: getEffectiveUserId(),
        date,
        completed,
        value: val || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...completions,
    ];
  }

  saveStoredCompletions(updated);
  return {
    success: true,
    message: completed
      ? "Super ! Ton accomplissement a été enregistré."
      : "Pas de souci, tu feras mieux demain !",
  };
}
