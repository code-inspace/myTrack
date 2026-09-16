"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import {
  ListTodo,
  Calendar,
  Moon,
  BookOpen,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ChevronRight,
} from "lucide-react";
import { TASK_TABS, TasksTab } from "@/components/shared/TasksHeaderWithNav";

interface DesktopSidebarNavProps {
  activeTab?: TasksTab;
  onChangeTab?: (tab: TasksTab) => void;
}

export const DesktopSidebarNav: React.FC<DesktopSidebarNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const currentTab: TasksTab =
    activeTab ||
    (pathname.includes("/agenda") || pathname.includes("/sleep")
      ? "agenda"
      : pathname.includes("/bilan")
      ? "bilan"
      : pathname.includes("/projects")
      ? "projects"
      : "habits");

  const userInitial = (user?.name?.[0] || user?.email?.[0] || "A").toUpperCase();
  const userName = user?.name || user?.email || "Mon compte";

  return (
    <aside className="hidden md:flex flex-col w-[72px] xl:w-56 bg-[#0C0D10] border-r border-[#1A1B21] h-screen fixed top-0 left-0 z-50 select-none transition-all duration-300">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-3 xl:px-4 py-5 border-b border-[#1A1B21] flex-shrink-0">
        <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-[#D4F63D] flex items-center justify-center shadow-lg shadow-[#D4F63D]/20">
          <span className="text-black font-black text-base leading-none">M</span>
        </div>
        <div className="hidden xl:block min-w-0">
          <span className="text-white font-extrabold text-sm tracking-tight truncate block">myTrack</span>
          <span className="text-[#6B7280] text-[10px] font-medium truncate block">Organisateur personnel</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 xl:px-3 space-y-1 min-h-0">
        {TASK_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          const content = (
            <>
              <div
                className={cn(
                  "w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-[#D4F63D]/15"
                    : "group-hover:bg-[#1E1F27]"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-200",
                    isActive ? "text-[#D4F63D]" : "text-[#6B7280] group-hover:text-[#C0C4CF]"
                  )}
                />
              </div>
              <span
                className={cn(
                  "hidden xl:block text-sm font-semibold truncate transition-colors duration-200",
                  isActive ? "text-white" : "text-[#6B7280] group-hover:text-[#C0C4CF]"
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="hidden xl:block ml-auto w-1.5 h-1.5 rounded-full bg-[#D4F63D]" />
              )}
            </>
          );

          const baseClass = cn(
            "group w-full flex items-center gap-3 px-1.5 xl:px-2 py-1.5 rounded-xl transition-all duration-200 cursor-pointer relative",
            isActive
              ? "bg-[#1A1C24] border border-[#2D3040] shadow-sm"
              : "hover:bg-[#14151B] border border-transparent"
          );

          if (onChangeTab) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={baseClass}
                title={tab.label}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={tab.id} href={tab.href} className={baseClass} title={tab.label}>
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Profile + Settings */}
      <div className="flex-shrink-0 border-t border-[#1A1B21] p-2 xl:p-3 space-y-1">
        <Link
          href="/profile"
          className="group flex items-center gap-3 px-1.5 xl:px-2 py-2 rounded-xl hover:bg-[#14151B] border border-transparent hover:border-[#252730] transition-all duration-200 cursor-pointer"
          title="Profil"
        >
          <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-[#D4F63D] flex items-center justify-center font-extrabold text-sm text-black shadow-sm">
            {userInitial}
          </div>
          <div className="hidden xl:block min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{userName}</div>
            <div className="text-[10px] text-[#6B7280] truncate">Mon profil</div>
          </div>
          <ChevronRight className="hidden xl:block w-3.5 h-3.5 text-[#6B7280] group-hover:text-[#C0C4CF] flex-shrink-0 transition-colors" />
        </Link>
      </div>
    </aside>
  );
};
