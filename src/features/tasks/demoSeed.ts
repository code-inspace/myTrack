import { Task, TaskCompletion } from "./types";
import { format, subDays } from "date-fns";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export function generateDemoSeedTasks(userId: string = DEMO_USER_ID): Task[] {
  const now = new Date().toISOString();

  return [
    {
      id: "demo-task-1",
      userId,
      title: "Séance Musculation",
      description: "Haut du corps & Gainage",
      category: "Sport",
      startTime: "07:00",
      endTime: "08:00",
      recurrence: "DAILY",
      recurrenceConfig: null,
      dateOverrides: {},
      trackingType: "DURATION",
      targetValue: 60,
      unit: "min",
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: subDays(new Date(), 180).toISOString(),
      updatedAt: now,
    },
    {
      id: "demo-task-2",
      userId,
      title: "Méditation & Respiration",
      description: "10 minutes de pleine conscience",
      category: "Santé",
      startTime: "08:30",
      endTime: "08:45",
      recurrence: "DAILY",
      recurrenceConfig: null,
      dateOverrides: {},
      trackingType: "BOOLEAN",
      targetValue: null,
      unit: null,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: subDays(new Date(), 180).toISOString(),
      updatedAt: now,
    },
    {
      id: "demo-task-3",
      userId,
      title: "Lecture 20 pages",
      description: "Livre sur la productivité ou tech",
      category: "Apprentissage",
      startTime: "20:30",
      endTime: "21:15",
      recurrence: "DAILY",
      recurrenceConfig: null,
      dateOverrides: {},
      trackingType: "NUMBER",
      targetValue: 20,
      unit: "pages",
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: subDays(new Date(), 180).toISOString(),
      updatedAt: now,
    },
    {
      id: "demo-task-4",
      userId,
      title: "Boire 2L d'eau",
      description: "Hydratation tout au long de la journée",
      category: "Santé",
      startTime: null, // All-day
      endTime: null,
      recurrence: "DAILY",
      recurrenceConfig: null,
      dateOverrides: {},
      trackingType: "BOOLEAN",
      targetValue: null,
      unit: null,
      isActive: false,
      startedAt: null,
      isArchived: false,
      createdAt: subDays(new Date(), 180).toISOString(),
      updatedAt: now,
    },
  ];
}

export function generateDemoSeedCompletions(userId: string = DEMO_USER_ID): TaskCompletion[] {
  const completions: TaskCompletion[] = [];
  const today = new Date();

  // Generate 180 days of realistic history
  for (let i = 180; i >= 0; i--) {
    const d = subDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayOfWeek = d.getDay(); // 0 = Dim, 6 = Sam

    // Progressive completion probability (higher for recent days)
    const completionBonus = (180 - i) / 180; // 0.0 to 1.0

    // Task 1 (Muscu): Done 4-6 days a week
    const t1Chance = 0.4 + completionBonus * 0.45;
    const t1Done = (i % 7 !== 0) && (((i * 13) % 100) / 100 < t1Chance);
    completions.push({
      id: `comp-demo-1-${dateStr}`,
      taskId: "demo-task-1",
      userId,
      date: dateStr,
      completed: t1Done,
      value: t1Done ? 60 : null,
      duration: t1Done ? 60 : null,
      scheduledStartTime: "07:00",
      scheduledEndTime: "08:00",
      actualStartTime: t1Done ? "07:05" : null,
      actualEndTime: t1Done ? "08:05" : null,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    });

    // Task 2 (Méditation): Very regular habit
    const t2Chance = 0.5 + completionBonus * 0.4;
    const t2Done = (((i * 7) % 100) / 100 < t2Chance);
    completions.push({
      id: `comp-demo-2-${dateStr}`,
      taskId: "demo-task-2",
      userId,
      date: dateStr,
      completed: t2Done,
      scheduledStartTime: "08:30",
      scheduledEndTime: "08:45",
      actualStartTime: t2Done ? "08:32" : null,
      actualEndTime: t2Done ? "08:47" : null,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    });

    // Task 3 (Lecture): Done on weekdays and relaxed weekends
    const t3Chance = 0.45 + completionBonus * 0.4;
    const t3Done = (((i * 17) % 100) / 100 < t3Chance);
    completions.push({
      id: `comp-demo-3-${dateStr}`,
      taskId: "demo-task-3",
      userId,
      date: dateStr,
      completed: t3Done,
      value: t3Done ? 20 : null,
      scheduledStartTime: "20:30",
      scheduledEndTime: "21:15",
      actualStartTime: t3Done ? "20:35" : null,
      actualEndTime: t3Done ? "21:20" : null,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    });

    // Task 4 (Eau): Daily habit
    const t4Chance = 0.6 + completionBonus * 0.35;
    const t4Done = (((i * 19) % 100) / 100 < t4Chance);
    completions.push({
      id: `comp-demo-4-${dateStr}`,
      taskId: "demo-task-4",
      userId,
      date: dateStr,
      completed: t4Done,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    });
  }

  return completions;
}
