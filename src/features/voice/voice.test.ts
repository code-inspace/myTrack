import { describe, it, expect } from "vitest";
import { parseVoiceTranscriptToTasks } from "./parser";

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
