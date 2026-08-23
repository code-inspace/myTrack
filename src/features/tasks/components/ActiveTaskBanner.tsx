"use client";

import React, { useState, useEffect } from "react";
import { TaskWithCompletion } from "../types";
import { Clock, Repeat, Square, Edit3, Check } from "lucide-react";

interface ActiveTaskBannerProps {
  task: TaskWithCompletion;
  onStop: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onOpenLogModal: (task: TaskWithCompletion) => void;
  onUpdateStartTime?: (taskId: string, newTime: string) => void;
}

const RECURRENCE_LABEL_MAP: Record<string, string> = {
  DAILY: "Quotidien",
  WEEKDAYS: "Lun - Ven",
  WEEKLY: "Hebdomadaire",
  CUSTOM: "Personnalisé",
  ONCE: "Une fois",
};

export const ActiveTaskBanner: React.FC<ActiveTaskBannerProps> = ({
  task,
  onStop,
  onOpenLogModal,
  onUpdateStartTime,
}) => {
  const calculateElapsed = (startedAtIso?: string | null) => {
    if (startedAtIso) {
      const startTime = new Date(startedAtIso).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((now - startTime) / 1000));
    }
    return 0;
  };

  const [elapsedSeconds, setElapsedSeconds] = useState(() => calculateElapsed(task.startedAt));
  const [isEditingStartTime, setIsEditingStartTime] = useState(false);

  const getInitialTimeStr = () => {
    if (task.startedAt) {
      const d = new Date(task.startedAt);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return task.startTime || "09:00";
  };

  const [inputStartTime, setInputStartTime] = useState(getInitialTimeStr);

  useEffect(() => {
    setElapsedSeconds(calculateElapsed(task.startedAt));
    setInputStartTime(getInitialTimeStr());

    const timer = setInterval(() => {
      setElapsedSeconds(calculateElapsed(task.startedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [task.startedAt, task.id]);

  const handleSaveStartTime = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputStartTime || !inputStartTime.includes(":")) return;
    onUpdateStartTime?.(task.id, inputStartTime);
    setIsEditingStartTime(false);
  };

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
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
          Arrêter
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
            + Enregistrer
          </button>
        </div>
      )}

      {/* Bottom row: Time, editable start time and recurrence */}
      <div className="mt-3.5 pt-3 border-t border-black/10 flex items-center justify-between text-xs font-medium text-[#111214]">
        <div className="flex items-center gap-3">
          {/* Editable Start Time */}
          {isEditingStartTime ? (
            <form onSubmit={handleSaveStartTime} className="flex items-center gap-1.5 bg-black/15 p-1 rounded-xl">
              <input
                type="time"
                value={inputStartTime}
                onChange={(e) => setInputStartTime(e.target.value)}
                autoFocus
                className="h-7 px-2 rounded-lg bg-black text-[#D4F63D] text-xs font-mono font-bold outline-none text-center box-border"
              />
              <button
                type="submit"
                className="p-1 rounded-lg bg-black text-[#D4F63D] hover:scale-105 transition-transform cursor-pointer"
                title="Valider l'heure de début"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingStartTime(true)}
              className="flex items-center gap-1.5 bg-black/10 hover:bg-black/15 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="Cliquer pour modifier l'heure de démarrage"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Début : <strong>{inputStartTime}</strong></span>
              <Edit3 className="w-3 h-3 opacity-60 ml-0.5" />
            </button>
          )}

          <div className="flex items-center gap-1 opacity-80">
            <Repeat className="w-3.5 h-3.5" />
            <span>{RECURRENCE_LABEL_MAP[task.recurrence] || "Quotidien"}</span>
          </div>
        </div>

        {/* Counter automatically recalculates on start time change */}
        <div className="font-mono font-bold bg-black text-[#D4F63D] px-3 py-1 rounded-xl text-xs shadow-sm">
          ⏱ {formatTimer(elapsedSeconds)}
        </div>
      </div>
    </div>
  );
};
