"use client";

import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface HeaderAction {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
}

interface HeaderAvatarAction {
  href?: string;
  onClick?: () => void;
  initial: string;
  label: string;
}

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  /** True when background sync is in progress */
  isSyncing?: boolean;
  /** Icon button shown top-left (e.g. Dashboard access in "modern" display mode) */
  leftAction?: HeaderAction | null;
  /** Initial-letter avatar shown top-right (e.g. Profile access in "modern" display mode) */
  rightAction?: HeaderAvatarAction | null;
  /** Icon button shown top-right */
  rightIconAction?: HeaderAction | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = "Mes Tâches",
  subtitle,
  isSyncing,
  leftAction,
  rightAction,
  rightIconAction,
}) => {
  if (!leftAction && !rightAction && !rightIconAction) {
    return (
      <header className="w-full flex items-center justify-center py-3 px-1">
        <div className="text-center">
          <h1 className="text-lg font-extrabold text-white tracking-tight inline-flex items-center gap-1.5">
            <span>{title}</span>
            {isSyncing && (
              <span
                title="Synchronisation en arrière-plan..."
                className="w-2 h-2 rounded-full bg-[#D4F63D] animate-ping"
              />
            )}
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
          leftAction.onClick ? (
            <button
              type="button"
              onClick={leftAction.onClick}
              aria-label={leftAction.label}
              title={leftAction.label}
              className="w-9 h-9 rounded-full bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#3D4252] flex items-center justify-center transition-colors cursor-pointer"
            >
              <leftAction.icon className="w-4 h-4 text-[#D4F63D]" />
            </button>
          ) : (
            <Link
              href={leftAction.href || "#"}
              aria-label={leftAction.label}
              title={leftAction.label}
              className="w-9 h-9 rounded-full bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#3D4252] flex items-center justify-center transition-colors"
            >
              <leftAction.icon className="w-4 h-4" />
            </Link>
          )
        )}
      </div>

      <div className="text-center flex-1 min-w-0">
        <h1 className="text-lg font-extrabold text-white tracking-tight truncate inline-flex items-center justify-center gap-1.5">
          <span>{title}</span>
          {isSyncing && (
            <span
              title="Synchronisation en cours..."
              className="w-2 h-2 rounded-full bg-[#D4F63D] animate-pulse flex-shrink-0"
            />
          )}
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium text-[#8E929E] -mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      <div className="w-9 h-9 flex-shrink-0 flex items-center justify-end">
        {rightIconAction ? (
          rightIconAction.onClick ? (
            <button
              type="button"
              onClick={rightIconAction.onClick}
              aria-label={rightIconAction.label}
              title={rightIconAction.label}
              className="w-9 h-9 rounded-full bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#3D4252] flex items-center justify-center transition-colors cursor-pointer"
            >
              <rightIconAction.icon className="w-4 h-4 text-[#D4F63D]" />
            </button>
          ) : (
            <Link
              href={rightIconAction.href || "#"}
              aria-label={rightIconAction.label}
              title={rightIconAction.label}
              className="w-9 h-9 rounded-full bg-[#1C1D22] border border-[#282A30] text-[#8E929E] hover:text-white hover:border-[#3D4252] flex items-center justify-center transition-colors"
            >
              <rightIconAction.icon className="w-4 h-4 text-[#D4F63D]" />
            </Link>
          )
        ) : rightAction ? (
          rightAction.onClick ? (
            <button
              type="button"
              onClick={rightAction.onClick}
              aria-label={rightAction.label}
              title={rightAction.label}
              className="w-9 h-9 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-extrabold text-sm shadow-sm cursor-pointer"
            >
              {rightAction.initial}
            </button>
          ) : (
            <Link
              href={rightAction.href || "#"}
              aria-label={rightAction.label}
              title={rightAction.label}
              className="w-9 h-9 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-extrabold text-sm shadow-sm"
            >
              {rightAction.initial}
            </Link>
          )
        ) : null}
      </div>
    </header>
  );
};
