"use client";

import React, { useState, useEffect } from "react";
import { useTasks, useTaskMutations } from "@/features/tasks/hooks";
import { getTodayDateString } from "@/lib/dates";
import { startLockScreenLiveActivity, stopLockScreenLiveActivity } from "@/lib/media-session";
import { Check, Pause, Play, X, Zap, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

export const DynamicIsland: React.FC = () => {
  const selectedDate = getTodayDateString();
  const { tasks, activeTask } = useTasks(selectedDate);
  const { toggleTaskActive, toggleCompletion, updateCompletionValue } = useTaskMutations();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(32); // Initial demo timer

  const currentActiveTask = tasks.find((t) => t.id === activeTask?.id);

  // Timer interval
  useEffect(() => {
    if (!currentActiveTask || isPaused) return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentActiveTask, isPaused]);

  // Activate Lock Screen Live Activity via Media Session API
  useEffect(() => {
    if (currentActiveTask) {
      startLockScreenLiveActivity(currentActiveTask, {
        onTogglePlay: () => setIsPaused((prev) => !prev),
        onComplete: () => {
          confetti({
            particleCount: 35,
            spread: 60,
            origin: { y: 0.2 },
            colors: ["#D4F63D", "#FFFFFF"],
          });
          toggleCompletion.mutate({ taskId: currentActiveTask.id, date: selectedDate });
          toggleTaskActive.mutate(currentActiveTask.id);
        },
      });
    } else {
      stopLockScreenLiveActivity();
    }

    return () => {
      stopLockScreenLiveActivity();
    };
  }, [currentActiveTask]);

  if (!currentActiveTask) return null;

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleValidate = (e: React.MouseEvent) => {
    e.stopPropagation();
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.2 },
      colors: ["#D4F63D", "#FFFFFF"],
    });
    toggleCompletion.mutate({ taskId: currentActiveTask.id, date: selectedDate });
    toggleTaskActive.mutate(currentActiveTask.id);
    setIsExpanded(false);
  };

  const isQuantitative =
    currentActiveTask.trackingType === "NUMBER" ||
    currentActiveTask.trackingType === "QUANTITY" ||
    currentActiveTask.trackingType === "DURATION";

  return (
    <div className="fixed top-2.5 inset-x-0 z-50 flex justify-center pointer-events-none px-3">
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          "pointer-events-auto bg-black border border-white/15 text-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer overflow-hidden",
          isExpanded
            ? "w-full max-w-sm rounded-[32px] p-5 backdrop-blur-2xl bg-black/95 ring-1 ring-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            : "w-[210px] h-[36px] rounded-full px-3.5 py-1.5 flex items-center justify-between hover:scale-[1.03] active:scale-95 shadow-lg"
        )}
      >
        {!isExpanded ? (
          /* ================= COMPACT DYNAMIC ISLAND PILL (Exact Screenshot 2) ================= */
          <div className="w-full flex items-center justify-between select-none">
            {/* Left: Lime Glowing Logo Icon */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[#D4F63D] flex items-center justify-center text-black font-black text-[11px] shadow-[0_0_10px_rgba(212,246,61,0.6)] animate-pulse">
                M
              </div>
            </div>

            {/* Right: Live Timer */}
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white tracking-tight">
              <span>{formatTimer(seconds)}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] animate-ping" />
            </div>
          </div>
        ) : (
          /* ================= EXPANDED LIVE ACTIVITY CARD (Exact Screenshot 1) ================= */
          <div className="w-full space-y-3.5 select-none animate-in fade-in zoom-in-95 duration-200">
            {/* Top header row: Category / Phase & Timer */}
            <div className="flex items-center justify-between text-xs text-[#8E929E]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white/90">
                  {currentActiveTask.category || "Activité en cours"}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/40" />
                <span className="text-[#D4F63D] font-mono font-bold">
                  {formatTimer(seconds)}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="p-1 text-[#8E929E] hover:text-white rounded-full bg-white/10"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Main Title and Set Info */}
            <div className="flex items-start justify-between gap-3 pt-1">
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {currentActiveTask.title}
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  {isQuantitative
                    ? `Objectif : ${currentActiveTask.currentValue ?? 0} / ${currentActiveTask.targetValue ?? 50} ${currentActiveTask.unit || "reps"}`
                    : "Session active • Focus"}
                </p>
              </div>

              {/* Big Checkmark Validation Action Button (Exact Screenshot 1) */}
              <button
                onClick={handleValidate}
                title="Valider la tâche"
                className="w-11 h-11 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] active:scale-90 text-white flex items-center justify-center shadow-lg transition-all flex-shrink-0"
              >
                <Check className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            {/* Live Activities Permission / Controls Footer */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused((prev) => !prev);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 transition-all text-xs"
                >
                  {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                  <span>{isPaused ? "Reprendre" : "Pause"}</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskActive.mutate(currentActiveTask.id);
                    setIsExpanded(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-[#F87171] font-semibold transition-all text-xs"
                >
                  Arrêter
                </button>
              </div>

              <span className="text-[11px] text-[#6B7280] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#D4F63D]" />
                Live Activity
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
