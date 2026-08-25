import { describe, it, expect } from "vitest";
import {
  parseVoiceTranscriptToTasks,
  parseVoiceTranscriptToActions,
  findBestMatchingTask,
} from "./parser";

describe("Voice Transcript to Tasks Parser", () => {
  it("parses the user's multi-task voice recording accurately", () => {
    const transcript =
      "Nouvelle tâche mardi prochain envoyer un email à Laurent Nouvelle tâche tous les mercredis aller au cours de danse à 17h";
    const referenceDateStr = "2026-08-23"; // Sunday

    const tasks = parseVoiceTranscriptToTasks(transcript, referenceDateStr);

    expect(tasks.length).toBe(2);

    // Task 1: "Envoyer un email à Laurent"
    expect(tasks[0].title).toBe("Envoyer un email à Laurent");
    expect(tasks[0].recurrence).toBe("ONCE");
    expect(tasks[0].targetDate).toBe("2026-08-25"); // Tuesday
    expect(tasks[0].category).toBe("Travail");

    // Task 2: "Aller au cours de danse"
    expect(tasks[1].title).toBe("Aller au cours de danse");
    expect(tasks[1].recurrence).toBe("WEEKLY");
    expect(tasks[1].recurrenceConfig?.days).toEqual([3]); // Wednesday
    expect(tasks[1].startTime).toBe("17:00");
    expect(tasks[1].endTime).toBe("18:00");
    expect(tasks[1].category).toBe("Sport");
  });

  it("parses single daily task", () => {
    const transcript = "Tous les jours faire 20 pompes";
    const tasks = parseVoiceTranscriptToTasks(transcript, "2026-08-23");

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Faire 20 pompes");
    expect(tasks[0].recurrence).toBe("DAILY");
    expect(tasks[0].category).toBe("Sport");
  });
});

describe("Reminder voice intent", () => {
  it("parses 'rappelle moi dans 10 mins d'acheter du pain'", () => {
    const tasks = parseVoiceTranscriptToTasks("rappelle moi dans 10 mins d'acheter du pain", "2026-08-23");
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Acheter du pain");
    expect(tasks[0].enableReminders).toBe(true);
    expect(tasks[0].reminderOffsetMinutes).toBe(0);
    expect(tasks[0].startTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it("parses the action-first order too", () => {
    const tasks = parseVoiceTranscriptToTasks("rappelle-moi d'acheter du pain dans 2 heures", "2026-08-23");
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Acheter du pain");
    expect(tasks[0].enableReminders).toBe(true);
  });
});

describe("Complete task voice intent", () => {
  it("detects 'fermer la tâche hello world' as a complete action", () => {
    const actions = parseVoiceTranscriptToActions("fermer la tâche hello world", "2026-08-23");
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe("complete");
    if (actions[0].kind === "complete") {
      expect(actions[0].query).toBe("hello world");
    }
  });

  it("matches the closest existing task by title", () => {
    const tasks = [
      { id: "1", title: "Hello World" },
      { id: "2", title: "Faire les courses" },
    ];
    const match = findBestMatchingTask("hello world", tasks);
    expect(match?.id).toBe("1");
  });

  it("still detects normal create-task phrases as 'create'", () => {
    const actions = parseVoiceTranscriptToActions("Tous les jours faire 20 pompes", "2026-08-23");
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe("create");
  });

  it("doesn't mistake an ordinary task phrase for a close command", () => {
    const actions = parseVoiceTranscriptToActions("Termine le rapport avant vendredi", "2026-08-23");
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe("create");
  });
});
