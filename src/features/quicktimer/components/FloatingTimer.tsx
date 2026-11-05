"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useQuickTimer } from "../useQuickTimer";
import { RunningTimerCard } from "./RunningTimerCard";

/** Keeps the running timer one tap away on every page except where it is already shown in full. */
export const FloatingTimer: React.FC = () => {
  const pathname = usePathname();
  const { timer } = useQuickTimer();
  if (!timer || pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/session")) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-40 flex justify-center px-3 md:bottom-4 md:left-auto md:right-4 md:justify-end">
      <div className="pointer-events-auto w-full max-w-md md:w-80">
        <RunningTimerCard compact />
      </div>
    </div>
  );
};
