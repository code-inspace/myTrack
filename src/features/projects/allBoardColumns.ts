"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { DEFAULT_PROJECT_COLUMNS, ProjectColumn, getProjectColumns } from "./types";

const STORAGE_KEY = "mytrack_all_projects_board_columns";
const METADATA_KEY = "allProjectsBoardColumns";

function isValidColumns(value: unknown): value is ProjectColumn[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((c) => c && typeof c.id === "string" && typeof c.label === "string")
  );
}

function readLocal(userId?: string): ProjectColumn[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId || ""}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return isValidColumns(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(columns: ProjectColumn[], userId?: string) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId || ""}`, JSON.stringify(columns));
  } catch {
    // storage unavailable: the user metadata copy still persists it
  }
}

/**
 * Columns of the "all projects" board, per user: cached in localStorage and persisted in the
 * Supabase auth user metadata (so they follow the user across devices).
 */
export function useAllProjectsBoardColumns(userId?: string) {
  const [columns, setColumns] = useState<ProjectColumn[]>(
    () => readLocal(userId) || DEFAULT_PROJECT_COLUMNS,
  );

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }: { data: { user: { user_metadata?: Record<string, unknown> } | null } }) => {
        const remote = data?.user?.user_metadata?.[METADATA_KEY];
        if (cancelled) return;
        if (isValidColumns(remote)) {
          setColumns(remote);
          writeLocal(remote, userId);
        } else {
          // Signed-in user resolved after the first render: use that user's cached columns
          const local = readLocal(userId);
          if (local) setColumns(local);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveColumns = useCallback(
    async (next: ProjectColumn[]) => {
      // Same cleanup as project columns: no empty names, at least one column, exactly a done one
      let clean = next.map((c) => ({ ...c, label: c.label.trim() })).filter((c) => c.label);
      if (clean.length === 0) clean = DEFAULT_PROJECT_COLUMNS;
      clean = getProjectColumns({ columns: clean });
      setColumns(clean);
      writeLocal(clean, userId);
      try {
        await createClient().auth.updateUser({ data: { [METADATA_KEY]: clean } });
      } catch (err) {
        console.warn("Saving all-projects board columns note:", err);
      }
    },
    [userId],
  );

  return { columns, saveColumns };
}
