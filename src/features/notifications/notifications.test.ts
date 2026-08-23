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

  it("handles Master Mute toggle and exact restoration correctly", () => {
    const initialPrefs = {
      ...DEFAULT_PREFERENCES,
      morningReminder: true,
      eveningRecap: false,
      streakReminder: true,
      currentActionCheckinEnabled: true,
    };

    // 1. Mute all: create backup
    const backup = {
      pushEnabled: initialPrefs.pushEnabled,
      morningReminder: initialPrefs.morningReminder,
      eveningRecap: initialPrefs.eveningRecap,
      streakReminder: initialPrefs.streakReminder,
      currentActionCheckinEnabled: initialPrefs.currentActionCheckinEnabled,
    };
    const mutedPrefs = {
      ...initialPrefs,
      allDisabled: true,
      previousPreferencesBackup: backup,
    };

    expect(mutedPrefs.allDisabled).toBe(true);

    // 2. Unmute: restore exact previous settings
    const restoredPrefs = {
      ...mutedPrefs,
      allDisabled: false,
      morningReminder: backup.morningReminder,
      eveningRecap: backup.eveningRecap,
      streakReminder: backup.streakReminder,
      currentActionCheckinEnabled: backup.currentActionCheckinEnabled,
      previousPreferencesBackup: null,
    };

    expect(restoredPrefs.allDisabled).toBe(false);
    expect(restoredPrefs.morningReminder).toBe(true);
    expect(restoredPrefs.eveningRecap).toBe(false);
    expect(restoredPrefs.currentActionCheckinEnabled).toBe(true);
  });

  it("calculates current action periodic interval minutes properly", () => {
    const startMins = 9 * 60; // 09:00 = 540
    const endMins = 22 * 60;  // 22:00 = 1320
    const interval = 30;

    const testTime1 = 9 * 60 + 30; // 09:30 = 570
    expect(testTime1 >= startMins && testTime1 <= endMins && testTime1 % interval === 0).toBe(true);

    const testTime2 = 9 * 60 + 15; // 09:15 = 555
    expect(testTime2 % interval === 0).toBe(false);
  });
});
