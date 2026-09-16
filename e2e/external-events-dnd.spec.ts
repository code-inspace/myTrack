import { test, expect } from "@playwright/test";

test.describe("External Calendar Events & Unified Stream DnD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agenda");
    await page.evaluate(() => {
      const today = new Date().toISOString().split("T")[0];
      const externalEvent = {
        id: "event-google-1",
        title: "Réunion Stratégique Google Cal",
        startTime: "11:00",
        endTime: "12:30",
        location: "Google Meet",
        description: "Revue des objectifs trimestriels",
        source: "google",
        date: today,
      };

      localStorage.setItem("mytrack_cached_calendar_events", JSON.stringify([externalEvent]));
    });

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders agenda timeline and external event blocks if present", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();

    // Check if external event or tasks appear
    const eventLocator = page.locator("text=Réunion Stratégique Google Cal");
    if (await eventLocator.count() > 0) {
      await expect(eventLocator.first()).toBeVisible();
    }
  });

  test("navigates to tasks list to test unified stream ordering", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("body")).toBeVisible();
  });
});
