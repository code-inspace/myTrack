"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shared/AppHeader";
import { HorizontalDatePicker } from "@/features/tasks/components/HorizontalDatePicker";
import { ListTodo, Calendar, Moon, BookOpen, FolderKanban, LayoutDashboard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDisplayMode } from "@/providers/DisplayModeProvider";
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
  { id: "agenda", href: "/agenda", label: "Agenda", icon: Calendar, activePaths: ["/agenda", "/sleep", "/bilan"] },
  { id: "projects", href: "/projects", label: "Projets", icon: FolderKanban, activePaths: ["/projects"] },
];

interface TasksHeaderWithNavProps {
  title?: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  activeTab?: TasksTab;
  onChangeTab?: (tab: TasksTab) => void;
  isSyncing?: boolean;
  /** true while a habit card is being dragged, to hint that the day strip accepts drops */
  isDragActive?: boolean;
  onDropDate?: (dateStr: string, taskId: string) => void;
}

export const TasksHeaderWithNav: React.FC<TasksHeaderWithNavProps> = ({
  title = "Mes Tâches",
  selectedDate,
  onSelectDate,
  activeTab,
  onChangeTab,
  isSyncing,
  isDragActive,
  onDropDate,
}) => {
  const pathname = usePathname();
  const { displayMode } = useDisplayMode();
  const { user } = useAuth();

  const currentTab: TasksTab =
    activeTab ||
    (pathname.includes("/agenda") || pathname.includes("/sleep") || pathname.includes("/bilan")
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

      {/* 3. Cohesive Segmented View Switcher (Habitudes / Agenda / Projets) —
          only in "classic" display mode; in "modern" mode these tabs live in the bottom nav. */}
      {displayMode === "classic" && (
        <div className="px-3 pb-3 pt-0.5">
          <div
            className="flex items-center gap-1 overflow-x-auto scrollbar-none touch-pan-x overscroll-x-contain p-1 bg-[#1A1C22] rounded-2xl border border-[#2B2E38] shadow-inner max-w-md mx-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {TASK_TABS.map((v) => {
              const Icon = v.icon;
              const isActive = currentTab === v.id;

              if (onChangeTab) {
                return (
                  <button
                    key={v.id}
                    data-testid={`nav-tab-${v.id}`}
                    type="button"
                    onClick={() => onChangeTab(v.id as TasksTab)}
                    className={cn(
                      "flex-shrink-0 min-w-[92px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-center",
                      isActive
                        ? "bg-[#272A34] text-white shadow-md ring-1 ring-[#3D4252] scale-[1.02]"
                        : "text-[#8E929E] hover:text-[#D1D5DB] hover:bg-[#20232B]/60"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 transition-colors",
                        isActive ? "text-[#D4F63D]" : "text-[#8E929E]"
                      )}
                    />
                    <span>{v.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={v.href}
                  data-testid={`nav-tab-${v.id}`}
                  href={v.href}
                  className={cn(
                    "flex-shrink-0 min-w-[92px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-center",
                    isActive
                      ? "bg-[#272A34] text-white shadow-md ring-1 ring-[#3D4252] scale-[1.02]"
                      : "text-[#8E929E] hover:text-[#D1D5DB] hover:bg-[#20232B]/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 transition-colors",
                      isActive ? "text-[#D4F63D]" : "text-[#8E929E]"
                    )}
                  />
                  <span>{v.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
