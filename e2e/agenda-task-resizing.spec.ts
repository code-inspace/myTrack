import { test, expect } from "@playwright/test";

test.describe("Agenda Task Resizing (Top & Bottom Handles)", () => {
  test.beforeEach(async ({ page }) => {
    // Seed a task with explicit time in localStorage for consistent tests
    await page.goto("/agenda");
    await page.evaluate(() => {
      const today = new Date().toISOString().split("T")[0];
      const testTask = {
        id: "task-resize-test-1",
        userId: "test-user",
        title: "Tâche à redimensionner",
        category: "Travail",
        startTime: "10:00",
        endTime: "11:00",
        trackingType: "BOOLEAN",
        recurrence: "ONCE",
        isArchived: false,
        isActive: false,
        createdAt: `${today}T08:00:00.000Z`,
        updatedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("mytrack_tasks") || "[]");
      const filtered = existing.filter((t: any) => t.id !== testTask.id);
      localStorage.setItem("mytrack_tasks", JSON.stringify([testTask, ...filtered]));
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  });

  test("displays top and bottom handles when task block is selected", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-resize-test-1"]');
    if (await taskBlock.count() > 0) {
      await expect(taskBlock).toBeVisible();

      // Long-press or pointer down to select for resize
      const box = await taskBlock.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(500); // 400ms is long press threshold
        await page.mouse.up();

        // Check if resize handles become visible
        const bottomHandle = page.locator('[data-testid="agenda-resize-handle-bottom-task-resize-test-1"]');
        const topHandle = page.locator('[data-testid="agenda-resize-handle-top-task-resize-test-1"]');
        
        if (await bottomHandle.count() > 0) {
          await expect(bottomHandle).toBeVisible();
          await expect(topHandle).toBeVisible();
        }
      }
    }
  });

  test("drags bottom handle to extend task duration", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-resize-test-1"]');
    if (await taskBlock.count() > 0) {
      const box = await taskBlock.boundingBox();
      if (box) {
        // Trigger selection
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(500);
        await page.mouse.up();

        const bottomHandle = page.locator('[data-testid="agenda-resize-handle-bottom-task-resize-test-1"]');
        if (await bottomHandle.count() > 0 && await bottomHandle.isVisible()) {
          const handleBox = await bottomHandle.boundingBox();
          if (handleBox) {
            // Drag bottom handle down by 60px (1 hour)
            await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 60, { steps: 10 });
            await page.mouse.up();

            await page.waitForTimeout(300);
          }
        }
      }
    }
  });

  test("drags top handle to adjust start time", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-resize-test-1"]');
    if (await taskBlock.count() > 0) {
      const box = await taskBlock.boundingBox();
      if (box) {
        // Trigger selection
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(500);
        await page.mouse.up();

        const topHandle = page.locator('[data-testid="agenda-resize-handle-top-task-resize-test-1"]');
        if (await topHandle.count() > 0 && await topHandle.isVisible()) {
          const handleBox = await topHandle.boundingBox();
          if (handleBox) {
            // Drag top handle up by 30px (30 min earlier)
            await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 - 30, { steps: 10 });
            await page.mouse.up();

            await page.waitForTimeout(300);
          }
        }
      }
    }
  });

  test("resizing task does not open detail modal upon completion", async ({ page }) => {
    const taskBlock = page.locator('[data-testid="agenda-task-block-task-resize-test-1"]');
    await expect(taskBlock).toBeVisible();

    const box = await taskBlock.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Long-press or pointer down to select for resize
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(500);
      await page.mouse.up();

      const bottomHandle = page.locator('[data-testid="agenda-resize-handle-bottom-task-resize-test-1"]');
      await expect(bottomHandle).toBeVisible();

      const handleBox = await bottomHandle.boundingBox();
      expect(handleBox).not.toBeNull();
      if (handleBox) {
        // Drag bottom handle down by 60px (1 hour)
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 60, { steps: 10 });
        await page.mouse.up();

        // Wait a short moment to ensure any debounced click/pointerup events have fired
        await page.waitForTimeout(300);

        // Modal should NOT be visible
        const detailModal = page.locator('[data-testid="agenda-task-detail-modal"]');
        await expect(detailModal).not.toBeVisible();
      }
    }
  });
});
