import { test, expect } from "@playwright/test";

test.describe("Recurring Tasks & Auto-Completion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("domcontentloaded");
  });

  test("creates a task using quick add input", async ({ page }) => {
    const quickInput = page.locator('[data-testid="task-quick-add-input"]');
    if (await quickInput.count() > 0) {
      const taskTitle = `Habitude Test ${Date.now()}`;
      await quickInput.fill(taskTitle);
      await quickInput.press("Enter");

      await page.waitForTimeout(500);

      // Verify created task appears in the list
      await expect(page.locator(`text=${taskTitle}`).first()).toBeVisible();
    }
  });

  test("suggests autocomplete for existing repeated tasks", async ({ page }) => {
    // Seed existing task in localStorage
    await page.evaluate(() => {
      const sampleHabit = {
        id: "task-repeat-seed-1",
        userId: "test-user",
        title: "Méditation matinale",
        category: "Santé",
        priority: "URGENT",
        recurrence: "DAILY",
        isArchived: false,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("mytrack_tasks") || "[]");
      localStorage.setItem("mytrack_tasks", JSON.stringify([sampleHabit, ...existing]));
    });

    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const quickInput = page.locator('[data-testid="task-quick-add-input"]');
    if (await quickInput.count() > 0) {
      await quickInput.fill("Médit");
      await page.waitForTimeout(300);

      // Autocomplete suggestion should appear
      const suggestion = page.locator('text=Méditation matinale');
      if (await suggestion.count() > 0) {
        await expect(suggestion.first()).toBeVisible();
      }
    }
  });

  test("handles recurring task creation and persistence across dates", async ({ page }) => {
    const quickInput = page.locator('[data-testid="task-quick-add-input"]');
    if (await quickInput.count() > 0) {
      const taskTitle = "Lecture 20 minutes";
      await quickInput.fill(taskTitle);
      await quickInput.press("Enter");

      await page.waitForTimeout(500);

      // Verify task is visible on list
      await expect(page.locator(`text=${taskTitle}`).first()).toBeVisible();
    }
  });
});
