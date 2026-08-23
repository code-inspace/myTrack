"use client";

import React, { useEffect, useRef } from "react";
import { getStoredTasks, getStoredCompletions } from "@/features/tasks/actions";
import { getStoredPreferences, getStoredReminders } from "@/features/notifications/actions";
import { sendNativeNotification } from "@/lib/notifications/service";
import { getTodayDateString, isTaskScheduledForDate } from "@/lib/dates";

function subtractMinutesFromTimeString(timeStr: string, minutesToSubtract: number): string {
  if (!timeStr || !timeStr.includes(":")) return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  let totalMinutes = h * 60 + m - minutesToSubtract;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export default function NotificationWatcherProvider({ children }: { children: React.ReactNode }) {
  const sentNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkAndDispatchReminders = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const todayDateStr = getTodayDateString();

      const tasks = getStoredTasks();
      const completions = getStoredCompletions();
      const preferences = getStoredPreferences();
      const customReminders = getStoredReminders();

      // If Master Mute is ON or push is disabled globally, do not fire any notifications
      if (preferences.allDisabled || !preferences.pushEnabled) {
        return;
      }

      // 1. Periodic Current Action Check-in ("Que fais-tu actuellement ?")
      if (preferences.currentActionCheckinEnabled) {
        const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();
        const startH = parseInt((preferences.currentActionStartTime || "09:00").split(":")[0], 10) || 9;
        const startM = parseInt((preferences.currentActionStartTime || "09:00").split(":")[1], 10) || 0;
        const endH = parseInt((preferences.currentActionEndTime || "22:00").split(":")[0], 10) || 22;
        const endM = parseInt((preferences.currentActionEndTime || "22:00").split(":")[1], 10) || 0;

        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        const interval = preferences.currentActionIntervalMinutes || 30;
        const activeDays = preferences.currentActionDays || [0, 1, 2, 3, 4, 5, 6];

        if (
          activeDays.includes(now.getDay()) &&
          currentMinutesTotal >= startTotal &&
          currentMinutesTotal <= endTotal &&
          currentMinutesTotal % interval === 0
        ) {
          const cacheKey = `${todayDateStr}_current_action_${currentTimeStr}`;
          if (!sentNotificationsRef.current.has(cacheKey)) {
            sentNotificationsRef.current.add(cacheKey);

            sendNativeNotification({
              title: "⚡ Que fais-tu actuellement ?",
              body: "Prends 5 secondes pour enregistrer ton action ou ton habitude sur MyTrack !",
              tag: `current-action-${currentTimeStr}`,
              actions: [
                { action: "LOG", title: "📝 Enregistrer" },
                { action: "LATER", title: "Plus tard" },
              ],
            });
          }
        }
      }

      // 2. Task Reminders Dispatcher
      tasks.forEach((task) => {
        if (task.isArchived) return;
        if (task.enableReminders === false) return;

        // Check if task is scheduled for today
        const isScheduled = isTaskScheduledForDate(
          task.recurrence,
          task.recurrenceConfig,
          now,
          task.createdAt
        );
        if (!isScheduled) return;

        // Check if already completed today
        const completion = completions.find((c) => c.taskId === task.id && c.date === todayDateStr);
        if (completion?.completed) return;

        const effectiveStart =
          task.dateOverrides?.[todayDateStr]?.startTime || task.startTime;

        if (effectiveStart) {
          // Timed Task: calculate offset time (default 10 min before)
          const offset = task.reminderOffsetMinutes ?? 10;
          const targetNotificationTime = subtractMinutesFromTimeString(effectiveStart, offset);

          if (targetNotificationTime === currentTimeStr) {
            const cacheKey = `${todayDateStr}_${task.id}_${currentTimeStr}`;
            if (!sentNotificationsRef.current.has(cacheKey)) {
              sentNotificationsRef.current.add(cacheKey);

              const minutesText =
                offset === 0
                  ? "maintenant"
                  : `dans ${offset} minute${offset > 1 ? "s" : ""}`;

              sendNativeNotification({
                title: `⏰ Rappel : ${task.title}`,
                body: `Ton action "${task.title}" est programmée pour ${effectiveStart} (${minutesText}).`,
                tag: `task-${task.id}`,
                data: { taskId: task.id, date: todayDateStr },
              });
            }
          }
        } else {
          // All-Day Task: check reminderTimes (default 11:00 & 18:00)
          const reminderTimes = task.reminderTimes && task.reminderTimes.length > 0
            ? task.reminderTimes
            : ["11:00", "18:00"];

          if (reminderTimes.includes(currentTimeStr)) {
            const cacheKey = `${todayDateStr}_${task.id}_allday_${currentTimeStr}`;
            if (!sentNotificationsRef.current.has(cacheKey)) {
              sentNotificationsRef.current.add(cacheKey);

              sendNativeNotification({
                title: `🎯 Habitude du jour : ${task.title}`,
                body: `N'oublie pas de valider ton habitude "${task.title}" aujourd'hui !`,
                tag: `task-allday-${task.id}`,
                data: { taskId: task.id, date: todayDateStr },
              });
            }
          }
        }
      });

      // 2. Custom Interactive Reminders
      customReminders.forEach((rem) => {
        if (!rem.enabled) return;
        if (rem.time === currentTimeStr) {
          const cacheKey = `${todayDateStr}_custom_${rem.id}_${currentTimeStr}`;
          if (!sentNotificationsRef.current.has(cacheKey)) {
            sentNotificationsRef.current.add(cacheKey);

            sendNativeNotification({
              title: `💬 Question MyTrack`,
              body: rem.question,
              tag: `custom-${rem.id}`,
              data: { taskId: rem.taskId, reminderId: rem.id, date: todayDateStr },
            });
          }
        }
      });

      // 3. Morning Reminder (08:00)
      if (preferences.morningReminder && currentTimeStr === (preferences.morningReminderTime || "08:00")) {
        const cacheKey = `${todayDateStr}_morning_recap`;
        if (!sentNotificationsRef.current.has(cacheKey)) {
          sentNotificationsRef.current.add(cacheKey);

          const pendingCount = tasks.filter((t) => {
            const isSched = isTaskScheduledForDate(t.recurrence, t.recurrenceConfig, now, t.createdAt);
            const comp = completions.find((c) => c.taskId === t.id && c.date === todayDateStr);
            return !t.isArchived && isSched && !comp?.completed;
          }).length;

          sendNativeNotification({
            title: "☀️ Bonjour ! Ta journée MyTrack commence",
            body: `Tu as ${pendingCount} habitude${pendingCount > 1 ? "s" : ""} au programme aujourd'hui. Faisons de cette journée un succès !`,
            tag: "morning-recap",
          });
        }
      }

      // 4. Evening Recap (21:00)
      if (preferences.eveningRecap && currentTimeStr === (preferences.eveningRecapTime || "21:00")) {
        const cacheKey = `${todayDateStr}_evening_recap`;
        if (!sentNotificationsRef.current.has(cacheKey)) {
          sentNotificationsRef.current.add(cacheKey);

          const todayCompletions = completions.filter((c) => c.date === todayDateStr && c.completed).length;

          sendNativeNotification({
            title: "🌙 Bilan du soir MyTrack",
            body: `Tu as complété ${todayCompletions} habitude${todayCompletions > 1 ? "s" : ""} aujourd'hui. Bravo pour tes efforts !`,
            tag: "evening-recap",
          });
        }
      }
    };

    // Run initial check and then every 20 seconds
    checkAndDispatchReminders();
    const interval = setInterval(checkAndDispatchReminders, 20000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
