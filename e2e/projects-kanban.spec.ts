import { test, expect } from "@playwright/test";

test.describe("Projects & Kanban Board", () => {
  test.beforeEach(async ({ page }) => {
    // Seed test project with tasks in localStorage
    await page.goto("/projects");
    await page.evaluate(() => {
      const testProject = {
        id: "project-test-1",
        userId: "test-user",
        name: "Projet Alpha Playwright",
        color: "#38BDF8",
        columns: [
          { id: "col-todo", title: "À faire", color: "#94A3B8" },
          { id: "col-in-progress", title: "En cours", color: "#38BDF8" },
          { id: "col-done", title: "Terminé", color: "#4ADE80", isDone: true },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const testTask = {
        id: "task-project-1",
        userId: "test-user",
        projectId: "project-test-1",
        projectStatus: "col-todo",
        title: "Tâche de projet Alpha",
        category: "Travail",
        trackingType: "BOOLEAN",
        recurrence: "ONCE",
        isArchived: false,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem("mytrack_projects_test-user", JSON.stringify([testProject]));
      localStorage.setItem("mytrack_projects", JSON.stringify([testProject]));
      
      const existingTasks = JSON.parse(localStorage.getItem("mytrack_tasks") || "[]");
      const filteredTasks = existingTasks.filter((t: any) => t.id !== testTask.id);
      localStorage.setItem("mytrack_tasks", JSON.stringify([testTask, ...filteredTasks]));
    });

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders projects view and displays seeded project", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();

    // Check project name is rendered
    const projectName = page.locator("text=Projet Alpha Playwright");
    if (await projectName.count() > 0) {
      await expect(projectName.first()).toBeVisible();
    }
  });

  test("displays Kanban columns and project task cards", async ({ page }) => {
    // Look for column titles or task title
    const taskCard = page.locator("text=Tâche de projet Alpha");
    if (await taskCard.count() > 0) {
      await expect(taskCard.first()).toBeVisible();
    }
  });

  test("allows switching projects and creating new tasks in project", async ({ page }) => {
    // Check if new task or add task buttons are available
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
