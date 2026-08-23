"use client";

import React, { useState, useEffect } from "react";
import { TaskWithCompletion } from "../types";
import { Clock, Repeat, Square, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveTaskBannerProps {
  task: TaskWithCompletion;
  onStop: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onOpenLogModal: (task: TaskWithCompletion) => void;
}

export const ActiveTaskBanner: React.FC<ActiveTaskBannerProps> = ({
  task,
  onStop,
  onComplete,
  onOpenLogModal,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isQuantitative =
    task.trackingType === "NUMBER" ||
    task.trackingType === "QUANTITY" ||
    task.trackingType === "DURATION";

  return (
    <div className="relative overflow-hidden w-full bg-[#D4F63D] text-[#111214] rounded-3xl p-5 shadow-xl transition-all duration-300 transform hover:scale-[1.01] lime-glow-sm">
      {/* Top row: Title and Stop button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-[#111214] flex items-center justify-center animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-[#D4F63D]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111214] leading-tight">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-[#111214]/80 font-medium mt-0.5">
                {task.description}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => onStop(task.id)}
          className="bg-white text-[#111214] hover:bg-[#F3F4F6] active:scale-95 px-5 py-2 rounded-full font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          Stop
        </button>
      </div>

      {/* Progress / Quantitative values row if applicable */}
      {isQuantitative && (
        <div className="mt-3.5 pt-3 border-t border-black/10 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-[#111214]">
              {task.currentValue ?? 0}
            </span>
            {task.targetValue && (
              <span className="text-sm font-semibold text-[#111214]/70">
                / {task.targetValue} {task.unit || ""}
              </span>
            )}
          </div>

          <button
            onClick={() => onOpenLogModal(task)}
            className="text-xs font-bold uppercase tracking-wider bg-black/10 hover:bg-black/15 active:scale-95 px-3 py-1.5 rounded-lg transition-all"
          >
            + Log Progress
          </button>
        </div>
      )}

      {/* Bottom row: Time and recurrence */}
      <div className="mt-3 flex items-center justify-between text-xs font-medium text-[#111214]/80">
        <div className="flex items-center gap-4">
          {(task.startTime || task.endTime) && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {task.startTime || "05:30"}
                {task.endTime ? ` - ${task.endTime}` : ""}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" />
            <span className="capitalize">{task.recurrence.toLowerCase()}</span>
          </div>
        </div>

        <div className="font-mono font-semibold bg-black/10 px-2.5 py-0.5 rounded-md text-[11px]">
          ⏱ {formatTimer(elapsedSeconds)}
        </div>
      </div>
    </div>
  );
};
