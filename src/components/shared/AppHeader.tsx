"use client";

import React from "react";
import { Flame, Bell } from "lucide-react";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { Logo } from "@/components/shared/Logo";

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
    <header className="w-full flex items-center justify-between py-2.5 px-1">
      {/* Left: Brand Logo & Name */}
      <div className="flex items-center gap-2">
        <Logo size="sm" showText={true} />
      </div>

      {/* Center: Title / Subtitle if custom */}
      {title && title !== "Mes Tâches" && title !== "MyTrack" && (
        <div className="text-center truncate max-w-[140px]">
          <h1 className="text-xs font-bold text-white tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] font-medium text-[#8E929E] truncate">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Right: Flame Streak Badge + Notifications */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#1C1D22] border border-[#282A30] px-2.5 py-1 rounded-full shadow-sm">
          <Flame className="w-3.5 h-3.5 fill-[#F97316] text-[#F97316] animate-pulse" />
          <span className="text-xs font-extrabold text-white">{streak}</span>
        </div>

        <button
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className="w-8 h-8 rounded-full bg-[#1C1D22] hover:bg-[#252830] border border-[#282A30] flex items-center justify-center text-[#8E929E] hover:text-white transition-all cursor-pointer shadow-sm relative"
        >
          <Bell className="w-3.5 h-3.5" />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D4F63D]" />
        </button>
      </div>
    </header>
  );
};
