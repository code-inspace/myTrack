"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  CheckCircle2,
  Flame,
  Clock,
  Moon,
  TrendingUp,
  User as UserIcon,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";

interface DesktopHeaderProps {
  completedCount: number;
  totalCount: number;
  activeCount: number;
  completionRate: number;
  focusMinutes?: number;
  sleepDurationText?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenNewTask?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  completedCount,
  totalCount,
  activeCount,
  completionRate,
  focusMinutes = 0,
  sleepDurationText,
  searchQuery,
  onSearchChange,
  onOpenNewTask,
}) => {
  const { user } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const focusHours = Math.floor(focusMinutes / 60);
  const focusMins = focusMinutes % 60;
  const focusText =
    focusMinutes > 0
      ? `${focusHours > 0 ? `${focusHours}h ` : ""}${String(focusMins).padStart(2, "0")}m`
      : "0 min";

  return (
    <header className="hidden md:flex items-center justify-between gap-4 px-6 py-3 bg-[#141519]/80 backdrop-blur-xl border border-[#23252E] rounded-3xl mx-3 mt-3 shadow-sm select-none">
      {/* 1. Left: KPIs & Stats Pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {/* Tâches complétées */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C1D24] border border-[#2B2D38] text-xs font-semibold text-white">
          <div className="w-2 h-2 rounded-full bg-[#D4F63D] shadow-sm shadow-[#D4F63D]/50" />
          <span className="text-[#8E929E]">Tâches:</span>
          <span className="font-mono text-white">
            {completedCount}/{totalCount}
          </span>
        </div>

        {/* Taux de complétion */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C1D24] border border-[#2B2D38] text-xs font-semibold text-white">
          <TrendingUp className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="text-[#8E929E]">Taux:</span>
          <span className="font-mono text-[#38BDF8] font-bold">
            {completionRate}%
          </span>
        </div>

        {/* Tâches en cours */}
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C1D24] border border-[#2B2D38] text-xs font-semibold text-white">
            <Flame className="w-3.5 h-3.5 text-[#F97316] animate-pulse" />
            <span className="text-[#8E929E]">En cours:</span>
            <span className="font-mono text-[#F97316] font-bold">
              {activeCount}
            </span>
          </div>
        )}

        {/* Temps Focus */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C1D24] border border-[#2B2D38] text-xs font-semibold text-white">
          <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span className="text-[#8E929E]">Focus:</span>
          <span className="font-mono text-white">{focusText}</span>
        </div>

        {/* Sommeil */}
        {sleepDurationText && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C1D24] border border-[#2B2D38] text-xs font-semibold text-white">
            <Moon className="w-3.5 h-3.5 text-[#818CF8]" />
            <span className="text-[#8E929E]">Nuit:</span>
            <span className="font-mono text-[#818CF8] font-bold">
              {sleepDurationText}
            </span>
          </div>
        )}
      </div>

      {/* 2. Center/Right: Search Bar & Actions */}
      <div className="flex items-center gap-3">
        {/* Search Bar with ⌘K badge */}
        <div className="relative w-48 lg:w-72">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher une tâche..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-12 py-1.5 rounded-2xl bg-[#1A1B22] border border-[#282A34] text-xs text-white placeholder-[#6B7280] focus:border-[#D4F63D] outline-none transition-all"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#252832] border border-[#353846] text-[10px] font-mono text-[#8E929E]">
            ⌘K
          </kbd>
        </div>

        {/* Notification Icon */}
        <Link
          href="/dashboard"
          title="Notifications"
          className="relative p-2 rounded-2xl bg-[#1C1D24] hover:bg-[#252732] border border-[#2B2D38] text-[#8E929E] hover:text-white transition-all cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-[#D4F63D] text-black font-bold text-[9px] min-w-[15px] text-center">
            {completedCount}
          </span>
        </Link>

        {/* User Profile Pill with Avatar */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl bg-[#1C1D24] hover:bg-[#252732] border border-[#2B2D38] transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#D4F63D] to-[#818CF8] text-black font-bold text-xs flex items-center justify-center shadow-sm">
              {user?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-white leading-tight">
                {user?.name || "Axel"}
              </span>
              <span className="text-[9px] text-[#8E929E] leading-tight">
                Pro
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-[#1C1D24] border border-[#2D303E] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <Link
                href="/profile"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#D1D5DB] hover:text-white hover:bg-[#282B38] transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                Mon Profil
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#D1D5DB] hover:text-white hover:bg-[#282B38] transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D4F63D]" />
                Analytics & Bilan
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
