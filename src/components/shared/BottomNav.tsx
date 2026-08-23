"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, CalendarDays, History, TrendingUp, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  // Hide navigation on auth pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  const navItems = [
    { href: "/tasks", label: "Tâches", icon: ListTodo },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/history", label: "Historique", icon: History },
    { href: "/dashboard", label: "Stats", icon: TrendingUp },
    { href: "/chat", label: "Coach", icon: MessageSquare },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#111214]/95 backdrop-blur-xl border-t border-[#23242A] safe-bottom px-2 pt-2 pb-1.5">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === "/tasks" && pathname === "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 min-w-[56px]",
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
                  "text-[10px] font-semibold tracking-tight mt-1 transition-colors",
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
