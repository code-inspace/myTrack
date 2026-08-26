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
  Plus,
  Bell,
  HelpCircle,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TasksTab } from "@/components/shared/TasksHeaderWithNav";

interface DesktopSidebarProps {
  activeTab?: TasksTab;
  onChangeTab?: (tab: TasksTab) => void;
  onNewTask?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab = "habits",
  onChangeTab,
  onNewTask,
}) => {
  const pathname = usePathname();

  const navItems = [
    {
      id: "habits" as TasksTab,
      label: "Liste",
      icon: ListTodo,
      href: "/tasks",
      active: activeTab === "habits" || pathname === "/tasks" || pathname === "/",
    },
    {
      id: "agenda" as TasksTab,
      label: "Agenda",
      icon: Calendar,
      href: "/agenda",
      active: activeTab === "agenda" || pathname === "/agenda",
    },
    {
      id: "projects" as TasksTab,
      label: "Projets",
      icon: FolderKanban,
      href: "/projects",
      active: activeTab === "projects" || pathname === "/projects",
    },
    {
      id: "sleep" as TasksTab,
      label: "Sommeil",
      icon: Moon,
      href: "/sleep",
      active: activeTab === "sleep" || pathname === "/sleep",
    },
    {
      id: "bilan" as TasksTab,
      label: "Bilan",
      icon: BookOpen,
      href: "/bilan",
      active: activeTab === "bilan" || pathname === "/bilan",
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: TrendingUp,
      href: "/dashboard",
      active: pathname === "/dashboard",
    },
    {
      id: "chat",
      label: "Coach IA",
      icon: MessageSquare,
      href: "/chat",
      active: pathname === "/chat",
    },
  ];

  return (
    <aside className="hidden md:flex flex-col items-center justify-between w-16 lg:w-20 my-3 ml-3 p-3 rounded-3xl bg-[#141519] border border-[#23252E] shadow-2xl z-40 select-none flex-shrink-0">
      {/* Top Logo / Quick Add */}
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onNewTask}
          title="Créer une tâche (+)"
          className="w-11 h-11 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] text-black flex items-center justify-center shadow-lg shadow-[#D4F63D]/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="w-8 h-[1px] bg-[#282A32] my-1" />

        {/* Nav Items */}
        <nav className="flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = item.active;

            if (onChangeTab && (item.id === "habits" || item.id === "agenda" || item.id === "projects" || item.id === "sleep" || item.id === "bilan")) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id as TasksTab)}
                  title={item.label}
                  className={cn(
                    "relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer group",
                    isSelected
                      ? "bg-white text-black shadow-lg shadow-white/10"
                      : "text-[#8E929E] hover:text-white hover:bg-[#1E2027]"
                  )}
                >
                  <Icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", isSelected ? "stroke-[2.5]" : "")} />
                  
                  {/* Tooltip on hover */}
                  <span className="absolute left-full ml-3 px-2.5 py-1 rounded-xl bg-[#22242C] text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-[#30333E] shadow-xl z-50">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                className={cn(
                  "relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer group",
                  isSelected
                    ? "bg-white text-black shadow-lg shadow-white/10"
                    : "text-[#8E929E] hover:text-white hover:bg-[#1E2027]"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", isSelected ? "stroke-[2.5]" : "")} />
                
                {/* Tooltip on hover */}
                <span className="absolute left-full ml-3 px-2.5 py-1 rounded-xl bg-[#22242C] text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-[#30333E] shadow-xl z-50">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col items-center gap-2 pt-2 border-t border-[#282A32] w-full">
        <Link
          href="/dashboard"
          title="Vue boussole / Focus"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#8E929E] hover:text-white hover:bg-[#1E2027] transition-all cursor-pointer group relative"
        >
          <Compass className="w-4 h-4" />
          <span className="absolute left-full ml-3 px-2.5 py-1 rounded-xl bg-[#22242C] text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-[#30333E] shadow-xl z-50">
            Explorer
          </span>
        </Link>
        <Link
          href="/profile"
          title="Paramètres"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#8E929E] hover:text-white hover:bg-[#1E2027] transition-all cursor-pointer group relative"
        >
          <Settings className="w-4 h-4" />
          <span className="absolute left-full ml-3 px-2.5 py-1 rounded-xl bg-[#22242C] text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-[#30333E] shadow-xl z-50">
            Paramètres
          </span>
        </Link>
      </div>
    </aside>
  );
};
