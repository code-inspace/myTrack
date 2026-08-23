import { describe, it, expect } from "vitest";
import {
  DEFAULT_PREFERENCES,
  handleInteractiveNotificationResponse,
  getStoredPreferences,
  saveStoredPreferences,
} from "./actions";

describe("Notifications Feature Logic", () => {
  it("has proper default notification preferences", () => {
    expect(DEFAULT_PREFERENCES.pushEnabled).toBe(true);
    expect(DEFAULT_PREFERENCES.morningReminder).toBe(true);
    expect(DEFAULT_PREFERENCES.morningReminderTime).toBe("08:00");
    expect(DEFAULT_PREFERENCES.eveningRecap).toBe(true);
    expect(DEFAULT_PREFERENCES.eveningRecapTime).toBe("21:00");
  });

  it("handles interactive notification YES action properly", () => {
    const result = handleInteractiveNotificationResponse("task-test-1", {
      action: "YES",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Super");
  });

  it("handles interactive notification QUANTITY action properly", () => {
    const result = handleInteractiveNotificationResponse("task-test-2", {
      action: "QUANTITY",
      value: 50,
    });

    expect(result.success).toBe(true);
  });
});
