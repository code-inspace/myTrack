"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, TrendingUp, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  // Hide navigation on auth pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  const navItems = [
    { href: "/tasks", label: "Tâches", icon: ListTodo },
    { href: "/dashboard", label: "Dashboard", icon: TrendingUp },
    { href: "/chat", label: "Coach IA", icon: MessageSquare },
    { href: "/profile", label: "Profil", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#111214]/95 backdrop-blur-xl border-t border-[#23242A] safe-bottom px-4 pt-2 pb-2">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isTasksTab =
            item.href === "/tasks" &&
            (pathname === "/tasks" ||
              pathname === "/" ||
              pathname === "/agenda" ||
              pathname === "/sleep" ||
              pathname === "/bilan" ||
              pathname === "/history");
          const isActive = isTasksTab || (item.href !== "/tasks" && pathname === item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 min-w-[64px]",
                isActive
                  ? "text-white"
                  : "text-[#8E929E] hover:text-[#D1D5DB] hover:bg-[#1C1D22]/60"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isActive ? "scale-110 text-[#D4F63D]" : ""
                  )}
                />
                {isActive && (
                  <div className="absolute -bottom-1 inset-x-0 mx-auto w-1.5 h-1.5 rounded-full bg-[#D4F63D] lime-glow-sm" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-semibold tracking-tight mt-1 transition-colors",
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
