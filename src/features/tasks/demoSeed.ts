import { Task, TaskCompletion } from "./types";
import { format, subDays, addDays } from "date-fns";
import { DEMO_PROJECT_APP_ID, DEMO_PROJECT_HOME_ID } from "@/features/projects/demoSeed";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

function baseTask(userId: string, overrides: Partial<Task> & Pick<Task, "id" | "title" | "category" | "recurrence" | "trackingType">): Task {
  const now = new Date().toISOString();
  return {
    userId,
    description: null,
    startTime: null,
    endTime: null,
    deadline: null,
    priority: "NORMAL",
    recurrenceConfig: null,
    dateOverrides: {},
    targetValue: null,
    unit: null,
    isActive: false,
    startedAt: null,
    enableReminders: false,
    reminderOffsetMinutes: 10,
    reminderTimes: ["11:00", "18:00"],
    isArchived: false,
    sortOrder: null,
    projectId: null,
    projectStatus: null,
    createdAt: subDays(new Date(), 180).toISOString(),
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Demo account seed: covers every recurrence type, tracking type, category, priority level,
 * a deadline, both project column schemes (default + custom), and unassigned tasks — so the
 * demo showcases the Habits list, Agenda, Kanban boards, and Dashboard all at once.
 */
export function generateDemoSeedTasks(userId: string = DEMO_USER_ID): Task[] {
  const in3Days = format(addDays(new Date(), 3), "yyyy-MM-dd");
  const in5Days = format(addDays(new Date(), 5), "yyyy-MM-dd");

  return [
    // --- Recurring habits (tracked below with 180 days of completion history) ---
    baseTask(userId, {
      id: "demo-task-1",
      title: "Séance Musculation",
      description: "Haut du corps & Gainage",
      category: "Fitness",
      startTime: "07:00",
      endTime: "08:00",
      recurrence: "DAILY",
      trackingType: "DURATION",
      targetValue: 60,
      unit: "min",
    }),
    baseTask(userId, {
      id: "demo-task-2",
      title: "Méditation & Respiration",
      description: "10 minutes de pleine conscience",
      category: "Mindfulness",
      startTime: "08:30",
      endTime: "08:45",
      recurrence: "DAILY",
      trackingType: "BOOLEAN",
    }),
    baseTask(userId, {
      id: "demo-task-3",
      title: "Lecture 20 pages",
      description: "Livre sur la productivité ou tech",
      category: "Learning",
      startTime: "20:30",
      endTime: "21:15",
      recurrence: "DAILY",
      trackingType: "NUMBER",
      targetValue: 20,
      unit: "pages",
    }),
    baseTask(userId, {
      id: "demo-task-4",
      title: "Boire 2L d'eau",
      description: "Hydratation tout au long de la journée",
      category: "Health",
      recurrence: "DAILY",
      trackingType: "BOOLEAN",
    }),
    baseTask(userId, {
      id: "demo-task-5",
      title: "Créneau Deep Work",
      description: "Programmation sans distractions",
      category: "Productivity",
      startTime: "09:00",
      endTime: "11:00",
      recurrence: "WEEKDAYS",
      trackingType: "DURATION",
      targetValue: 120,
      unit: "min",
    }),
    baseTask(userId, {
      id: "demo-task-6",
      title: "Sortie vélo",
      description: "Boucle du dimanche",
      category: "Fitness",
      recurrence: "WEEKLY",
      recurrenceConfig: { days: [0] },
      trackingType: "QUANTITY",
      targetValue: 15,
      unit: "km",
    }),

    // --- One-off tasks: priority levels, a deadline, reminders ---
    baseTask(userId, {
      id: "demo-task-7",
      title: "Déclaration d'impôts",
      category: "General",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      priority: "VERY_URGENT",
      deadline: in3Days,
      createdAt: new Date().toISOString(),
      enableReminders: true,
    }),
    baseTask(userId, {
      id: "demo-task-8",
      title: "Appeler le dentiste",
      category: "Health",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      priority: "URGENT",
      deadline: in5Days,
      createdAt: new Date().toISOString(),
    }),

    // --- Project: "Lancement App Mobile" (default 4-column board) ---
    baseTask(userId, {
      id: "demo-task-9",
      title: "Maquettes UI onboarding",
      category: "Productivity",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      projectId: DEMO_PROJECT_APP_ID,
      projectStatus: "TODO",
    }),
    baseTask(userId, {
      id: "demo-task-10",
      title: "Intégrer l'authentification",
      category: "Productivity",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      priority: "URGENT",
      projectId: DEMO_PROJECT_APP_ID,
      projectStatus: "IN_PROGRESS",
    }),
    baseTask(userId, {
      id: "demo-task-11",
      title: "Retour de l'App Store",
      category: "Productivity",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      projectId: DEMO_PROJECT_APP_ID,
      projectStatus: "WAITING",
    }),
    baseTask(userId, {
      id: "demo-task-12",
      title: "Setup CI/CD",
      category: "Productivity",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      projectId: DEMO_PROJECT_APP_ID,
      projectStatus: "DONE",
    }),

    // --- Project: "Rénovation Appartement" (custom columns) ---
    baseTask(userId, {
      id: "demo-task-13",
      title: "Choisir le carrelage salle de bain",
      category: "General",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      projectId: DEMO_PROJECT_HOME_ID,
      projectStatus: "IDEAS",
    }),
    baseTask(userId, {
      id: "demo-task-14",
      title: "Devis plombier",
      category: "General",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      priority: "URGENT",
      projectId: DEMO_PROJECT_HOME_ID,
      projectStatus: "DEVIS",
    }),
    baseTask(userId, {
      id: "demo-task-15",
      title: "Peinture salon",
      category: "General",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      projectId: DEMO_PROJECT_HOME_ID,
      projectStatus: "TRAVAUX",
    }),
    baseTask(userId, {
      id: "demo-task-16",
      title: "Installation luminaires",
      category: "General",
      recurrence: "ONCE",
      trackingType: "BOOLEAN",
      projectId: DEMO_PROJECT_HOME_ID,
      projectStatus: "TERMINE",
    }),
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

    // Task 5 (Deep Work): Weekdays only
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const t5Chance = 0.5 + completionBonus * 0.4;
      const t5Done = ((i * 11) % 100) / 100 < t5Chance;
      completions.push({
        id: `comp-demo-5-${dateStr}`,
        taskId: "demo-task-5",
        userId,
        date: dateStr,
        completed: t5Done,
        value: t5Done ? 120 : null,
        duration: t5Done ? 120 : null,
        scheduledStartTime: "09:00",
        scheduledEndTime: "11:00",
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
      });
    }

    // Task 6 (Vélo): Sundays only
    if (dayOfWeek === 0) {
      const t6Done = ((i * 23) % 100) / 100 < 0.7;
      completions.push({
        id: `comp-demo-6-${dateStr}`,
        taskId: "demo-task-6",
        userId,
        date: dateStr,
        completed: t6Done,
        value: t6Done ? 15 : null,
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
      });
    }
  }

  return completions;
}
