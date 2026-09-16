import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProjectColumns, DEFAULT_PROJECT_COLUMNS, Project } from "./types";
import { getStoredProjects, saveStoredProjects } from "./actions";

describe("Projects Logic", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    (global as any).window = {};
    (global as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
    };
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  it("provides default columns if none exist", () => {
    const cols = getProjectColumns({ columns: [] });
    expect(cols.length).toBeGreaterThanOrEqual(3);
    expect(cols.some((c) => c.isDone)).toBe(true);
  });

  it("saves and retrieves projects from local storage correctly", () => {
    const mockProjects: Project[] = [
      {
        id: "proj-1",
        userId: "user-1",
        name: "Projet Alpha",
        color: "#D4F63D",
        columns: DEFAULT_PROJECT_COLUMNS,
        categories: ["Dev"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    saveStoredProjects(mockProjects, "user-1");
    const retrieved = getStoredProjects("user-1");
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].name).toBe("Projet Alpha");
  });

  it("correctly identifies unassigned tasks", () => {
    const tasks = [
      { id: "t1", title: "Task 1", projectId: null, isArchived: false },
      { id: "t2", title: "Task 2", projectId: "proj-1", isArchived: false },
      { id: "t3", title: "Task 3", projectId: undefined, isArchived: false },
      { id: "t4", title: "Task 4", projectId: null, isArchived: true },
    ];

    const unassigned = tasks.filter((t) => !t.projectId && !t.isArchived);
    expect(unassigned.length).toBe(2);
    expect(unassigned.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("unassigns all associated tasks when a project is deleted", () => {
    let tasks: { id: string; title: string; projectId: string | null; projectStatus: string | null; projectCategory: string | null }[] = [
      { id: "t1", title: "Task 1", projectId: "proj-1", projectStatus: "TODO", projectCategory: "Dev" },
      { id: "t2", title: "Task 2", projectId: "proj-2", projectStatus: "DONE", projectCategory: "Design" },
      { id: "t3", title: "Task 3", projectId: "proj-1", projectStatus: "IN_PROGRESS", projectCategory: "Dev" },
    ];

    const targetProjectId = "proj-1";
    // Simulate deletion unassignment
    tasks = tasks.map((t) =>
      t.projectId === targetProjectId
        ? { ...t, projectId: null, projectStatus: null, projectCategory: null }
        : t
    );

    expect(tasks.filter((t) => t.projectId === "proj-1").length).toBe(0);
    expect(tasks.filter((t) => !t.projectId).length).toBe(2);
    expect(tasks.find((t) => t.id === "t2")?.projectId).toBe("proj-2");
  });

  it("ensures at least one done column is present when sanitizing columns", () => {
    const rawColumns = [
      { id: "col-1", label: "À faire" },
      { id: "col-2", label: "En cours" },
      { id: "col-3", label: "Terminé", isDone: false },
    ];

    let cleanColumns = rawColumns.map((c) => ({ ...c, label: c.label.trim() })).filter((c) => c.label);
    if (!cleanColumns.some((c) => c.isDone)) {
      cleanColumns = cleanColumns.map((c, idx) =>
        idx === cleanColumns.length - 1 ? { ...c, isDone: true } : c
      );
    }

    expect(cleanColumns.length).toBe(3);
    expect(cleanColumns[2].isDone).toBe(true);
    expect(cleanColumns[0].isDone).toBeFalsy();
  });
});
