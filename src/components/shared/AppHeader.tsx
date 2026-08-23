"use client";

import React from "react";
import { Flame, Bell, Sparkles } from "lucide-react";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenNotifications?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = "Mes Tâches",
  subtitle,
  onOpenNotifications,
}) => {
  const { data: stats } = useDashboardStats();
  const streak = stats?.currentStreak ?? 0;

  return (
    <header className="w-full flex items-center justify-between py-3 px-1">
      {/* Left: Flame Streak Badge */}
      <div className="flex items-center gap-1.5 bg-[#1C1D22] border border-[#282A30] px-3 py-1.5 rounded-full shadow-sm">
        <Flame className="w-4 h-4 fill-[#F97316] text-[#F97316] animate-pulse" />
        <span className="text-sm font-extrabold text-white">{streak}</span>
      </div>

      {/* Center: Title */}
      <div className="text-center">
        <h1 className="text-lg font-extrabold text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium text-[#8E929E] -mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Quick Notification / Alert Action */}
      <button
        onClick={onOpenNotifications}
        aria-label="Notifications"
        className="w-9 h-9 rounded-full bg-[#1C1D22] hover:bg-[#252830] border border-[#282A30] flex items-center justify-center text-[#8E929E] hover:text-white transition-all cursor-pointer shadow-sm relative"
      >
        <Bell className="w-4 h-4" />
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D4F63D]" />
      </button>
    </header>
  );
};
