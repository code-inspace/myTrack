"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shared/AppHeader";
import { HorizontalDatePicker } from "@/features/tasks/components/HorizontalDatePicker";
import { ListTodo, Calendar, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TasksHeaderWithNavProps {
  title?: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenNotifications?: () => void;
  onNewTask?: () => void;
  activeTab?: "habits" | "agenda" | "sleep";
  onChangeTab?: (tab: "habits" | "agenda" | "sleep") => void;
}

export const TasksHeaderWithNav: React.FC<TasksHeaderWithNavProps> = ({
  title = "Mes Tâches",
  selectedDate,
  onSelectDate,
  onOpenNotifications,
  onNewTask,
  activeTab,
  onChangeTab,
}) => {
  const pathname = usePathname();

  const views: Array<{ id: "habits" | "agenda" | "sleep"; href: string; label: string; icon: any; activePaths: string[] }> = [
    { id: "habits", href: "/tasks", label: "Habitudes", icon: ListTodo, activePaths: ["/tasks", "/"] },
    { id: "agenda", href: "/agenda", label: "Agenda", icon: Calendar, activePaths: ["/agenda"] },
    { id: "sleep", href: "/sleep", label: "Sommeil", icon: Moon, activePaths: ["/sleep"] },
  ];

  const currentTab = activeTab || (pathname.includes("/agenda") ? "agenda" : pathname.includes("/sleep") ? "sleep" : "habits");

  return (
    <div className="sticky top-0 z-40 w-full bg-[#111214] border-b border-[#23242A] select-none shadow-md">
      {/* 1. App Header with profile and action button */}
      <AppHeader
        title={title}
        onOpenNotifications={onOpenNotifications}
        onNewTask={onNewTask}
      />

      {/* 2. 7-Day Horizontal Week Calendar */}
      <HorizontalDatePicker
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
      />

      {/* 3. Cohesive Segmented View Switcher (Habitudes / Agenda / Sommeil) */}
      <div className="px-3 pb-3 pt-0.5">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#1A1C22] rounded-2xl border border-[#2B2E38] shadow-inner max-w-sm mx-auto">
          {views.map((v) => {
            const Icon = v.icon;
            const isActive = currentTab === v.id;

            if (onChangeTab) {
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChangeTab(v.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-center",
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
                href={v.href}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-center",
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
    </div>
  );
};
