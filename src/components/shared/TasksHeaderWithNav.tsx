"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shared/AppHeader";
import { HorizontalDatePicker } from "@/features/tasks/components/HorizontalDatePicker";
import { ListTodo, Calendar, FolderKanban, type LucideIcon } from "lucide-react";
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
