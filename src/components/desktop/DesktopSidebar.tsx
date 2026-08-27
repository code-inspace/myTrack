"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListTodo,
  Calendar,
  Moon,
  BookOpen,
  FolderKanban,
  TrendingUp,
  MessageSquare,
  Settings,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TasksTab } from "@/components/shared/TasksHeaderWithNav";
import { useAuth } from "@/providers/AuthProvider";

interface DesktopSidebarProps {
  activeTab?: TasksTab;
  onChangeTab?: (tab: TasksTab) => void;
  onNewTask?: () => void;
}

const MAIN_NAV = [
  { id: "habits" as TasksTab, label: "Liste", icon: ListTodo, href: "/tasks", paths: ["/tasks", "/"] },
  { id: "agenda" as TasksTab, label: "Agenda", icon: Calendar, href: "/agenda", paths: ["/agenda"] },
  { id: "projects" as TasksTab, label: "Projets", icon: FolderKanban, href: "/projects", paths: ["/projects"] },
  { id: "sleep" as TasksTab, label: "Sommeil", icon: Moon, href: "/sleep", paths: ["/sleep"] },
  { id: "bilan" as TasksTab, label: "Bilan", icon: BookOpen, href: "/bilan", paths: ["/bilan"] },
];

const SECONDARY_NAV = [
  { label: "Dashboard", icon: TrendingUp, href: "/dashboard", paths: ["/dashboard"] },
  { label: "Coach IA", icon: MessageSquare, href: "/chat", paths: ["/chat"] },
];

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onChangeTab,
  onNewTask,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const currentTab: TasksTab =
    activeTab ||
    (pathname.includes("/agenda")
      ? "agenda"
      : pathname.includes("/sleep")
      ? "sleep"
      : pathname.includes("/bilan")
      ? "bilan"
      : pathname.includes("/projects")
      ? "projects"
      : "habits");

  const userInitial = (user?.name?.[0] || user?.email?.[0] || "A").toUpperCase();
  const userName = user?.name || user?.email?.split("@")[0] || "Mon compte";

  const isPathActive = (paths: string[]) =>
    paths.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));

  return (
    <aside className="hidden md:flex flex-col w-[70px] xl:w-[220px] h-screen bg-[#0A0B0E] border-r border-[#17181F] flex-shrink-0 sticky top-0 z-40 select-none">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-[#17181F] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#D4F63D] flex items-center justify-center shadow-lg shadow-[#D4F63D]/20 flex-shrink-0">
          <Zap className="w-4 h-4 text-black stroke-[3]" />
        </div>
        <div className="hidden xl:block min-w-0">
          <span className="text-white font-black text-base tracking-tight block leading-tight">myTrack</span>
          <span className="text-[#555] text-[10px] font-medium block">Tracker personnel</span>
        </div>
      </div>

      {/* ── Main Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 xl:px-3 space-y-0.5 min-h-0">
        {MAIN_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isByPath = isPathActive(item.paths);
          const active = isActive || isByPath;

          const cls = cn(
            "group w-full flex items-center gap-3 py-2.5 px-2.5 rounded-xl transition-all duration-150 cursor-pointer relative",
            active
              ? "bg-[#D4F63D]/10 text-white"
              : "text-[#5C6070] hover:text-[#B8BCCA] hover:bg-[#13141A]"
          );

          const inner = (
            <>
              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#D4F63D] rounded-full" />
              )}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150",
                  active ? "bg-[#D4F63D]/20" : "group-hover:bg-[#1A1B22]"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4",
                    active ? "text-[#D4F63D]" : "text-current"
                  )}
                />
              </div>
              <span className="hidden xl:block text-sm font-semibold truncate">{item.label}</span>
            </>
          );

          if (onChangeTab) {
            return (
              <button key={item.id} type="button" onClick={() => onChangeTab(item.id)} className={cls} title={item.label}>
                {inner}
              </button>
            );
          }

          return (
            <Link key={item.id} href={item.href} className={cls} title={item.label}>
              {inner}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="my-3 mx-2 border-t border-[#17181F]" />

        {/* Secondary nav */}
        {SECONDARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isPathActive(item.paths);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group w-full flex items-center gap-3 py-2.5 px-2.5 rounded-xl transition-all duration-150 cursor-pointer",
                active
                  ? "bg-[#D4F63D]/10 text-white"
                  : "text-[#5C6070] hover:text-[#B8BCCA] hover:bg-[#13141A]"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150",
                  active ? "bg-[#D4F63D]/20" : "group-hover:bg-[#1A1B22]"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-[#D4F63D]" : "text-current")} />
              </div>
              <span className="hidden xl:block text-sm font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Profile / Footer ── */}
      <div className="flex-shrink-0 border-t border-[#17181F] p-2 xl:p-3">
        <Link
          href="/profile"
          title="Profil"
          className="group flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-[#13141A] transition-all duration-150 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4F63D] to-[#a8cc1a] flex items-center justify-center font-extrabold text-sm text-black flex-shrink-0 shadow-sm">
            {userInitial}
          </div>
          <div className="hidden xl:block min-w-0 flex-1">
            <div className="text-xs font-bold text-[#D1D5DB] truncate">{userName}</div>
            <div className="text-[10px] text-[#555] truncate">Voir le profil</div>
          </div>
          <ChevronRight className="hidden xl:block w-3.5 h-3.5 text-[#444] group-hover:text-[#888] flex-shrink-0 transition-colors" />
        </Link>

        <Link
          href="/profile/notifications"
          title="Paramètres"
          className="group flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-[#13141A] transition-all duration-150 cursor-pointer mt-0.5"
        >
          <div className="w-8 h-8 rounded-lg bg-[#17181F] flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E1F27] transition-all">
            <Settings className="w-3.5 h-3.5 text-[#5C6070] group-hover:text-[#B8BCCA]" />
          </div>
          <span className="hidden xl:block text-xs font-medium text-[#5C6070] group-hover:text-[#B8BCCA] truncate transition-colors">
            Paramètres
          </span>
        </Link>
      </div>
    </aside>
  );
};
