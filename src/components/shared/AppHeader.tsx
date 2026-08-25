"use client";

import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface HeaderAction {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface HeaderAvatarAction {
  href: string;
  initial: string;
  label: string;
}

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  /** Icon button shown top-left (e.g. Dashboard access in "modern" display mode) */
  leftAction?: HeaderAction | null;
  /** Initial-letter avatar shown top-right (e.g. Profile access in "modern" display mode) */
  rightAction?: HeaderAvatarAction | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = "Mes Tâches",
  subtitle,
  leftAction,
  rightAction,
}) => {
  if (!leftAction && !rightAction) {
    return (
      <header className="w-full flex items-center justify-center py-3 px-1">
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
      </header>
    );
  }

  return (
    <header className="w-full flex items-center justify-between py-3 px-3 gap-2">
      <div className="w-9 h-9 flex-shrink-0">
        {leftAction && (
          <Link
            href={leftAction.href}
            aria-label={leftAction.label}
            title={leftAction.label}
            className="w-9 h-9 rounded-full bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#3D4252] flex items-center justify-center transition-colors"
          >
            <leftAction.icon className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="text-center flex-1 min-w-0">
        <h1 className="text-lg font-extrabold text-white tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium text-[#8E929E] -mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      <div className="w-9 h-9 flex-shrink-0">
        {rightAction && (
          <Link
            href={rightAction.href}
            aria-label={rightAction.label}
            title={rightAction.label}
            className="w-9 h-9 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-extrabold text-sm shadow-sm"
          >
            {rightAction.initial}
          </Link>
        )}
      </div>
    </header>
  );
};
