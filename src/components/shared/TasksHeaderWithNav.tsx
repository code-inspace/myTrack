"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shared/AppHeader";
import { HorizontalDatePicker } from "@/features/tasks/components/HorizontalDatePicker";
import { ListTodo, Calendar, FolderKanban, Timer, type LucideIcon } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export type TasksTab = "habits" | "agenda" | "projects";

export interface TaskTabDef {
  id: TasksTab | "dashboard";
  href: string;
  label: string;
  icon: LucideIcon;
  activePaths: string[];
}

/** Shared with BottomNav, which renders these same tabs in bottom nav. */
export const TASK_TABS: TaskTabDef[] = [
  { id: "habits", href: "/tasks", label: "Liste", icon: ListTodo, activePaths: ["/tasks", "/"] },
  { id: "agenda", href: "/agenda", label: "Agenda", icon: Calendar, activePaths: ["/agenda"] },
  { id: "projects", href: "/projects", label: "Projets", icon: FolderKanban, activePaths: ["/projects"] },
];

interface TasksHeaderWithNavProps {
  title?: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  activeTab?: TasksTab;
  isSyncing?: boolean;
  /** true while a habit card is being dragged, to hint that the day strip accepts drops */
  isDragActive?: boolean;
  onDropDate?: (dateStr: string, taskId: string, originDate?: string) => void;
}

export const TasksHeaderWithNav: React.FC<TasksHeaderWithNavProps> = ({
  title = "Mes Tâches",
  selectedDate,
  onSelectDate,
  activeTab,
  isSyncing,
  isDragActive,
  onDropDate,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const currentTab: TasksTab =
    activeTab ||
    (pathname.includes("/agenda")
      ? "agenda"
      : pathname.includes("/projects")
      ? "projects"
      : "habits");

  return (
    <div className="sticky top-0 z-40 w-full bg-[#111214] border-b border-[#23242A] select-none shadow-md md:hidden">
      {/* 1. App Header (Clean centered title, no extra header buttons) */}
      <AppHeader
        title={title}
        isSyncing={isSyncing}
      />

      {/* Liste / Agenda switch: one "Tâches" entry in the bottom nav, two views of the same day */}
      {currentTab !== "projects" && (
        <div className="flex items-center justify-center gap-2 px-3 pb-1.5">
          <div
            role="group"
            aria-label="Affichage des tâches"
            className="mx-auto flex w-full max-w-[220px] items-center rounded-full border border-[#282A30] bg-[#1C1D22] p-0.5"
          >
            {[
              { id: "habits", label: "Liste", href: "/tasks" },
              { id: "agenda", label: "Agenda", href: "/agenda" },
            ].map((v) => (
              <Link
                key={v.id}
                href={v.href}
                aria-current={currentTab === v.id ? "page" : undefined}
                className={`flex-1 rounded-full py-1 text-center text-[12px] font-semibold transition-colors ${
                  currentTab === v.id ? "bg-white text-black font-bold" : "text-[#8E929E] hover:text-white"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </div>
          <Link
            href="/session"
            className="flex flex-shrink-0 items-center gap-1 rounded-full border border-[#D4F63D]/40 px-3 py-1 text-[12px] font-bold text-[#D4F63D] hover:bg-[#D4F63D]/10"
          >
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            Session
          </Link>
        </div>
      )}

      {/* 2. Horizontal Date Picker Day Strip (always visible on Tasks/Agenda/Projects) */}
      {currentTab !== "projects" && (
        <div className="px-3 pb-2 pt-0.5">
          <HorizontalDatePicker
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            isDragActive={isDragActive}
            onDropDate={onDropDate}
          />
        </div>
      )}
    </div>
  );
};
