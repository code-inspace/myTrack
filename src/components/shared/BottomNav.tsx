"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, TrendingUp, User, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_TABS } from "./TasksHeaderWithNav";

const TASKS_VIEW_KEY = "mytrack_tasks_view";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [lastTasksView, setLastTasksView] = useState<"/tasks" | "/agenda">("/tasks");

  // Remember which of the two task views was used last
  useEffect(() => {
    try {
      if (pathname === "/tasks" || pathname === "/agenda") {
        localStorage.setItem(TASKS_VIEW_KEY, pathname);
        setLastTasksView(pathname);
      } else {
        const stored = localStorage.getItem(TASKS_VIEW_KEY);
        if (stored === "/agenda" || stored === "/tasks") setLastTasksView(stored);
      }
    } catch {}
  }, [pathname]);

  // Hide navigation on auth pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  const navItems = [
    // Liste and Agenda are two views of the same tasks: one entry, reopening the last used view
    { href: lastTasksView, label: "Tâches", icon: ListTodo, activePaths: ["/tasks", "/agenda", "/session", "/"] },
    { href: "/projects", label: "Projets", icon: TASK_TABS.find((t) => t.id === "projects")?.icon || ListTodo, activePaths: ["/projects"] },
    { href: "/goals", label: "Objectifs", icon: Target, activePaths: ["/goals"] },
    { href: "/dashboard", label: "Dashboard", icon: TrendingUp, activePaths: ["/dashboard"] },
    { href: "/profile", label: "Profil", icon: User, activePaths: ["/profile"] },
  ];


  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111214] border-t border-[#23242A] px-3 pt-1.5"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.activePaths.includes(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-xl transition-all duration-200 min-w-[44px] flex-1",
                isActive
                  ? "text-white"
                  : "text-[#8E929E] hover:text-[#D1D5DB] hover:bg-[#1C1D22]/60"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  isActive ? "scale-110 text-[#D4F63D]" : ""
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-semibold tracking-tight mt-0.5 transition-colors",
                  isActive ? "text-white font-bold" : "text-[#8E929E]"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
