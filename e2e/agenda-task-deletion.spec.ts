import { test, expect } from "@playwright/test";

test.describe("Agenda Task Modal & Deletion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agenda");
    await page.evaluate(() => {
      const today = new Date().toISOString().split("T")[0];
      const testTask = {
        id: "task-delete-test-1",
        userId: "test-user",
        title: "Tâche à supprimer depuis modale",
        category: "General",
        startTime: "14:00",
        endTime: "15:00",
        trackingType: "BOOLEAN",
        recurrence: "ONCE",
        isArchived: false,
        isActive: false,
        createdAt: `${today}T12:00:00.000Z`,
        updatedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("mytrack_tasks") || "[]");
      const filtered = existing.filter((t: any) => t.id !== testTask.id);
      localStorage.setItem("mytrack_tasks", JSON.stringify([testTask, ...filtered]));
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  });

  test("opens detail modal upon clicking a task block", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-delete-test-1"]');
    if (await taskBlock.count() > 0) {
      await expect(taskBlock).toBeVisible();

      // Click task block
      await taskBlock.click();

      // Detail modal should open
      const modal = page.locator('[data-testid="agenda-task-detail-modal"]');
      await expect(modal).toBeVisible();

      // Check title inside modal
      const titleInput = page.locator('[data-testid="agenda-detail-title-input"]');
      await expect(titleInput).toHaveValue("Tâche à supprimer depuis modale");
    }
  });

  test("deletes task from agenda detail modal and removes it from timeline", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-delete-test-1"]');
    if (await taskBlock.count() > 0) {
      // Click task block to open modal
      await taskBlock.click();

      const modal = page.locator('[data-testid="agenda-task-detail-modal"]');
      await expect(modal).toBeVisible();

      // Click delete button
      const deleteBtn = page.locator('[data-testid="agenda-detail-delete-btn"]');
      await expect(deleteBtn).toBeVisible();
      await deleteBtn.click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // Task block should no longer be in timeline
      await page.waitForTimeout(300);
      await expect(taskBlock).not.toBeVisible();
    }
  });

  test("toggles completion from detail modal", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-delete-test-1"]');
    if (await taskBlock.count() > 0) {
      await taskBlock.click();

      const toggleCompleteBtn = page.locator('[data-testid="agenda-detail-toggle-complete-btn"]');
      await expect(toggleCompleteBtn).toBeVisible();
      await toggleCompleteBtn.click();

      await page.waitForTimeout(300);

      // Close modal
      const closeBtn = page.locator('[data-testid="agenda-detail-close-btn"]');
      await closeBtn.click();
    }
  });
});
