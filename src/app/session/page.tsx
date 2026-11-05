"use client";

import React, { Suspense } from "react";
import { Timer } from "lucide-react";
import { AppHeader } from "@/components/shared/AppHeader";
import { SessionPlanner } from "@/features/session/components/SessionPlanner";
import { SessionRunner } from "@/features/session/components/SessionRunner";
import { useSessionRunner } from "@/features/session/useSessionRunner";

export default function SessionPage() {
  const runner = useSessionRunner();

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-[#0E0F12] relative overflow-hidden">
      <div className="flex-shrink-0 z-30 shadow-md md:hidden bg-[#111214] border-b border-[#23242A]">
        <AppHeader title="Session" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        <div className="hidden md:block mx-auto w-full max-w-xl px-4 pt-6">
          <h1 className="flex items-center gap-3 text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            <Timer className="h-7 w-7 text-[#D4F63D]" />
            <span>Session</span>
          </h1>
          <p className="mt-0.5 text-xs text-[#8E929E]">
            Dis combien de temps tu as, choisis tes tâches : elles sont planifiées et un minuteur te guide.
          </p>
        </div>
        {runner.hydrated && (
          <Suspense fallback={null}>
            <SessionPlanner onLaunch={runner.start} />
          </Suspense>
        )}
      </div>

      {runner.state && (
        <SessionRunner
          state={runner.state}
          now={runner.now}
          current={runner.current}
          warning={runner.warning}
          remaining={runner.remaining}
          dispatch={runner.dispatch}
          onClose={runner.clear}
        />
      )}
    </div>
  );
}
