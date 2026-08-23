    date,
    bedtime: defaultBedtime,
    wakeTime: "07:00",
    bedtimeValidated: false,
    wakeTimeValidated: false,
    bedtimeOffsets: DEFAULT_BEDTIME_OFFSETS,
    bedtimeReminders: computeDefaultBedtimeReminders(defaultBedtime),
    enableBedtimeReminders: true,
    notes: "",
    gratitude: "",
    manifestation: "",
  };
}

/**
 * Calculates sleep duration for a night leading into day D:
 * Requires bedtime of eve (D-1) and wakeTime of morning (D) to be validated.
 */
export function getNightSleepDuration(
  wakeDateStr: string,
  userId?: string
): {
  duration: { hours: number; minutes: number; text: string; decHours: number };
  yesterdayBedtime: string;
  todayWakeTime: string;
} | null {
  try {
    const d = parseISO(wakeDateStr);
    const yesterdayStr = format(subDays(d, 1), "yyyy-MM-dd");

    const yesterdayLog = getStoredSleepLog(yesterdayStr, userId);
    const todayLog = getStoredSleepLog(wakeDateStr, userId);

    const hasYesterdayBedtime = Boolean(
      yesterdayLog.bedtime && (yesterdayLog.bedtimeValidated || yesterdayLog.updatedAt)
    );
    const hasTodayWakeTime = Boolean(
      todayLog.wakeTime && (todayLog.wakeTimeValidated || todayLog.updatedAt)
    );

    if (!hasYesterdayBedtime || !hasTodayWakeTime) {
      return null;
    }

    const duration = computeSleepDuration(yesterdayLog.bedtime, todayLog.wakeTime);
    if (!duration) return null;

    return {
      duration,
      yesterdayBedtime: yesterdayLog.bedtime || "23:00",
      todayWakeTime: todayLog.wakeTime || "07:00",
    };
  } catch (err) {
    console.warn("getNightSleepDuration error:", err);
    return null;
  }
}

/**
 * Saves sleep log to Supabase PostgreSQL database and updates localStorage
 */
export async function saveStoredSleepLog(
  log: DailySleepLog,
  userId?: string
): Promise<DailySleepLog> {
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  const key = `${SLEEP_STORAGE_PREFIX}${targetId}_${log.date}`;
  const nowIso = new Date().toISOString();

  const updatedLog: DailySleepLog = {
    ...log,
    updatedAt: nowIso,
  };

  // 1. Instant local persistence
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(updatedLog));
    } catch (err) {
      console.warn("saveStoredSleepLog local storage error:", err);
    }
  }

  // 2. Database persistence in Supabase (Timezone normalized to UTC)
  try {
    const utcBedtime = convertLocalTimeToUtc(updatedLog.bedtime || "23:00", updatedLog.date);
    const utcWakeTime = convertLocalTimeToUtc(updatedLog.wakeTime || "07:00", updatedLog.date);
    const utcReminders = (updatedLog.bedtimeReminders || []).map((r) =>
      convertLocalTimeToUtc(r, updatedLog.date)
    );

    // Primary payload attempting direct column writes
    const payload: any = {
      user_id: targetId,
      date: updatedLog.date,
      bedtime: utcBedtime,
      wake_time: utcWakeTime,
      bedtime_validated: Boolean(updatedLog.bedtimeValidated),
      wake_time_validated: Boolean(updatedLog.wakeTimeValidated),
      bedtime_offsets: updatedLog.bedtimeOffsets || DEFAULT_BEDTIME_OFFSETS,
      bedtime_reminders: utcReminders,
      enable_bedtime_reminders: updatedLog.enableBedtimeReminders !== false,
      notes: updatedLog.notes || null,
      gratitude: updatedLog.gratitude || null,
      manifestation: updatedLog.manifestation || null,
      updated_at: nowIso,
    };

    const { error } = await supabase.from("sleep_logs").upsert([payload], { onConflict: "user_id,date" });

    // Fallback if gratitude or manifestation column does not exist yet on remote table
    if (error) {
      console.warn("Supabase initial save error, trying resilient fallback:", error.message);
      const packedNotes = JSON.stringify({
        notes: updatedLog.notes || "",
        gratitude: updatedLog.gratitude || "",
        manifestation: updatedLog.manifestation || "",
      });

      const fallbackPayload: any = {
        user_id: targetId,
        date: updatedLog.date,
        bedtime: utcBedtime,
        wake_time: utcWakeTime,
        bedtime_validated: Boolean(updatedLog.bedtimeValidated),
        wake_time_validated: Boolean(updatedLog.wakeTimeValidated),
        bedtime_offsets: updatedLog.bedtimeOffsets || DEFAULT_BEDTIME_OFFSETS,
        bedtime_reminders: utcReminders,
        enable_bedtime_reminders: updatedLog.enableBedtimeReminders !== false,
        notes: packedNotes,
        updated_at: nowIso,
      };

      const fallbackRes = await supabase.from("sleep_logs").upsert([fallbackPayload], { onConflict: "user_id,date" });
      if (fallbackRes.error) {
        console.warn("Supabase resilient save error:", fallbackRes.error);
      }
    }
  } catch (err) {
    console.warn("Supabase saveStoredSleepLog network fallback:", err);
  }

  // 3. Schedule OneSignal bedtime push notifications & database reminder records if enabled
  if (updatedLog.enableBedtimeReminders && updatedLog.bedtimeReminders?.length > 0) {
    for (const rTime of updatedLog.bedtimeReminders) {
      const scheduledIso = createUtcIsoFromLocalDateTime(rTime, updatedLog.date);

      // Record in Supabase reminders table
      createDbReminder({
        userId: targetId || getEffectiveUserId(userId),
        title: "🌙 Préparation au Sommeil",
        body: `C'est l'heure de te préparer pour ton coucher prévu à ${updatedLog.bedtime || "23:00"} !`,
        scheduledAt: scheduledIso,
        reminderType: "bedtime",
      }).catch((e) => console.warn("Bedtime reminder DB record error:", e));

      // Push via OneSignal
      scheduleTaskPushNotification({
        userId: targetId,
        taskTitle: `Préparation au Sommeil (Coucher à ${updatedLog.bedtime})`,
        startTime: rTime,
        reminderOffsetMinutes: 0,
        date: updatedLog.date,
        category: "Sleep",
        replaceExisting: true,
      }).catch((err) => console.warn("Bedtime reminder schedule error:", err));
    }
  }

  return updatedLog;
}

/**
 * Fetches multi-day sleep history from Supabase
 */
export async function fetchSleepHistory(
  days: number = 30,
  userId?: string
): Promise<DailySleepLog[]> {
  const supabase = createClient();
  let targetId = userId;

  if (!targetId) {
    const { data: { session } } = await supabase.auth.getSession();
    targetId = session?.user?.id || getEffectiveUserId();
  }

  try {
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", targetId)
      .order("date", { ascending: false })