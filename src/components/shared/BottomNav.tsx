"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, TrendingUp, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDisplayMode } from "@/providers/DisplayModeProvider";
import { TASK_TABS } from "./TasksHeaderWithNav";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { displayMode } = useDisplayMode();

  // Hide navigation on auth pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  const navItems =
    displayMode === "modern"
      ? TASK_TABS.map((t) => ({ href: t.href, label: t.label, icon: t.icon, activePaths: t.activePaths }))
      : [
          { href: "/tasks", label: "Tâches", icon: ListTodo, activePaths: ["/tasks", "/", "/agenda", "/sleep", "/bilan", "/history"] },
          { href: "/dashboard", label: "Dashboard", icon: TrendingUp, activePaths: ["/dashboard"] },
          { href: "/chat", label: "Coach IA", icon: MessageSquare, activePaths: ["/chat"] },
          { href: "/profile", label: "Profil", icon: User, activePaths: ["/profile"] },
        ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111214]/95 backdrop-blur-xl border-t border-[#23242A] px-3 pt-1 pb-[env(safe-area-inset-bottom,6px)]">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.activePaths.includes(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[58px]",
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
                  "text-[10px] font-semibold tracking-tight mt-0.5 transition-colors",
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
