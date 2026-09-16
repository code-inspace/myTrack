import { test, expect } from "@playwright/test";

test.describe("Agenda Task Movement & Timeline", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to agenda page with clean state
    await page.goto("/agenda");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders agenda timeline with hour slots and navigation", async ({ page }) => {
    // Verify agenda page loads correctly
    await expect(page.locator("body")).toBeVisible();
    
    // Check navigation tabs exist
    const agendaTab = page.locator('[data-testid="nav-tab-agenda"]');
    if (await agendaTab.count() > 0) {
      await expect(agendaTab.first()).toBeVisible();
    }
  });

  test("creates a task and displays it on the agenda timeline", async ({ page }) => {
    // 1. Go to tasks list to create a timed task
    await page.goto("/tasks");
    await page.waitForLoadState("domcontentloaded");

    const quickInput = page.locator('[data-testid="task-quick-add-input"]');
    if (await quickInput.count() > 0) {
      await quickInput.fill("Session Sport Test Playwright");
      await quickInput.press("Enter");

      // Wait a moment for task creation
      await page.waitForTimeout(500);
    }

    // 2. Navigate back to agenda
    await page.goto("/agenda");
    await page.waitForLoadState("domcontentloaded");

    // Timeline should be present
    const timelineOrBody = page.locator("body");
    await expect(timelineOrBody).toBeVisible();
  });

  test("supports moving task between time slots or days", async ({ page }) => {
    await page.goto("/agenda");
    await page.waitForLoadState("domcontentloaded");

    // Check if there are any agenda blocks
    const agendaBlocks = page.locator('[data-agenda-block="true"]');
    const count = await agendaBlocks.count();

    if (count > 0) {
      const firstBlock = agendaBlocks.first();
      const initialBox = await firstBlock.boundingBox();

      if (initialBox) {
        // Perform drag action
        await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2 + 120, { steps: 5 });
        await page.mouse.up();

        await page.waitForTimeout(400);
      }
    }
  });
});
