"use client";

import React, { useState, useEffect, useRef } from "react";
import { DailySleepLog } from "../types";
import {
  getStoredSleepLog,
  fetchDbSleepLog,
  saveStoredSleepLog,
  computeDefaultBedtimeReminders,
  computeBedtimeRemindersFromOffsets,
  BEDTIME_OFFSET_OPTIONS,
  DEFAULT_BEDTIME_OFFSETS,
  getNightSleepDuration,
} from "../actions";
import {
  Moon,
  Sun,
  BellRing,
  BookOpen,
  Check,
  Sparkles,
  Clock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SleepJournalViewProps {
  selectedDate: string;
}

export const SleepJournalView: React.FC<SleepJournalViewProps> = ({ selectedDate }) => {
  const [log, setLog] = useState<DailySleepLog>(() => getStoredSleepLog(selectedDate));
  const [isSaved, setIsSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isEditingRef = useRef(false);

  // Synchronize state from Supabase / localStorage when selected date changes
  useEffect(() => {
    isEditingRef.current = false;
    // 1. Instant local render
    setLog(getStoredSleepLog(selectedDate));
    setIsSaved(false);

    // 2. Fetch fresh database record from Supabase
    fetchDbSleepLog(selectedDate).then((remoteLog) => {
      if (remoteLog && !isEditingRef.current) {
        setLog(remoteLog);
      }
    });
  }, [selectedDate]);

  const triggerSave = (updated: DailySleepLog) => {
    isEditingRef.current = true;
    setLog(updated);
    saveStoredSleepLog(updated).then(() => {
      setIsSaved(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setIsSaved(false);
        isEditingRef.current = false;
      }, 2500);
    });
  };

  const handleBedtimeChange = (newBedtime: string, markValidated = true) => {
    const offsets = log.bedtimeOffsets && log.bedtimeOffsets.length > 0
      ? log.bedtimeOffsets
      : DEFAULT_BEDTIME_OFFSETS;
    const reminders = computeBedtimeRemindersFromOffsets(newBedtime, offsets);
    const updated: DailySleepLog = {
      ...log,
      bedtime: newBedtime,
      bedtimeValidated: markValidated,
      bedtimeOffsets: offsets,
      bedtimeReminders: reminders,
    };
    triggerSave(updated);
  };

  const handleWakeTimeChange = (newWakeTime: string, markValidated = true) => {
    const updated: DailySleepLog = {
      ...log,
      wakeTime: newWakeTime,
      wakeTimeValidated: markValidated,
    };
    triggerSave(updated);
  };

  const handleSetBedtimeNow = () => {
    const now = new Date();
    const currentStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    handleBedtimeChange(currentStr, true);
  };

  const handleSetWakeTimeNow = () => {
    const now = new Date();
    const currentStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    handleWakeTimeChange(currentStr, true);
  };

  const handleToggleReminders = (enabled: boolean) => {
    const updated: DailySleepLog = {
      ...log,
      enableBedtimeReminders: enabled,
    };
    triggerSave(updated);
  };

  const handleToggleOffset = (offsetMinutes: number) => {
    const currentOffsets = log.bedtimeOffsets && log.bedtimeOffsets.length > 0
      ? log.bedtimeOffsets
      : DEFAULT_BEDTIME_OFFSETS;

    let nextOffsets: number[];
    if (currentOffsets.includes(offsetMinutes)) {
      nextOffsets = currentOffsets.filter((m) => m !== offsetMinutes);
    } else {
      nextOffsets = [...currentOffsets, offsetMinutes];
    }

    const nextReminders = computeBedtimeRemindersFromOffsets(log.bedtime || "23:00", nextOffsets);
    const updated: DailySleepLog = {
      ...log,
      bedtimeOffsets: nextOffsets,
      bedtimeReminders: nextReminders,
    };
    triggerSave(updated);
  };

  const handleNotesChange = (text: string) => {
    const updated: DailySleepLog = {
      ...log,
      notes: text,
    };
    setLog(updated);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveStoredSleepLog(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }, 600);
  };

  // Compute sleep duration between Eve (D-1) bedtime and Day (D) wakeTime
  const nightSleep = getNightSleepDuration(selectedDate);

  // Check if bedtime is past midnight (00:00 - 06:59) -> represents +1 jour
  const bedtimeHour = parseInt((log.bedtime || "23:00").split(":")[0], 10) || 0;
  const isPastMidnightBedtime = bedtimeHour >= 0 && bedtimeHour < 12;

  const activeOffsets = log.bedtimeOffsets && log.bedtimeOffsets.length > 0
    ? log.bedtimeOffsets
    : DEFAULT_BEDTIME_OFFSETS;

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-4 max-w-md mx-auto w-full">
      {/* Header with Save Confirmation */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sommeil & Bilan</h2>
          <p className="text-xs text-[#8E929E]">Suivi de tes nuits et journal de bord</p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F63D]/15 border border-[#D4F63D]/40 text-[#D4F63D] text-xs font-bold animate-in fade-in duration-200">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Enregistré</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ENCART HEURE DE COUCHER & BOUTONS RAPPELS RAPIDES                       */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#252830] border border-[#343740] flex items-center justify-center text-[#D4F63D] shadow-sm">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Heure de coucher</h3>
                {isPastMidnightBedtime && (
                  <span className="px-2 py-0.5 rounded-md bg-[#818CF8]/20 border border-[#818CF8]/40 text-[#818CF8] font-bold text-[10px]">
                    +1 jour
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8E929E]">Objectif pour ce soir</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="time"
              value={log.bedtime || "23:00"}
              onChange={(e) => handleBedtimeChange(e.target.value, true)}
              className="h-10 px-3 rounded-xl bg-[#252830] border border-[#343740] text-white font-mono font-bold text-sm focus:border-[#D4F63D] outline-none text-center cursor-pointer shadow-inner"
            />
          </div>
        </div>

        {/* Quick action: Je me couche maintenant */}
        <button
          type="button"
          onClick={handleSetBedtimeNow}
          className="w-full py-2.5 px-3 rounded-2xl bg-[#252830] hover:bg-[#2F333E] border border-[#343740] text-[#D4F63D] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Moon className="w-4 h-4" />
          <span>Je me couche maintenant</span>
        </button>

        {/* Rappels de coucher configurables par boutons rapides */}
        <div className="pt-3 border-t border-[#282A30] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#D4F63D]" />
              <span className="text-xs font-bold text-white">Rappels avant le coucher</span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={log.enableBedtimeReminders !== false}
                onChange={(e) => handleToggleReminders(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#343740] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4F63D]" />
            </label>
          </div>

          {log.enableBedtimeReminders !== false && (
            <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
              <p className="text-[11px] text-[#8E929E]">
                Sélectionne les moments où recevoir un rappel :
              </p>

              {/* Quick offset buttons: 1h, 30 min, 20 min, 15 min, À l'heure */}
              <div className="flex flex-wrap gap-2">
                {BEDTIME_OFFSET_OPTIONS.map((opt) => {
                  const isSelected = activeOffsets.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleToggleOffset(opt.value)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border shadow-sm",
                        isSelected
                          ? "bg-[#D4F63D] text-black border-[#D4F63D] font-extrabold"
                          : "bg-[#252830] text-[#8E929E] hover:text-white hover:border-[#4B5563] border-[#343740]"
                      )}
                    >
                      <Clock className={cn("w-3 h-3", isSelected ? "text-black" : "text-[#8E929E]")} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Calculated notification times summary */}
              {log.bedtimeReminders && log.bedtimeReminders.length > 0 && (
                <div className="p-2.5 rounded-2xl bg-[#17181D]/80 border border-[#282A30] flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <span className="text-[#8E929E] font-medium">Heures programmées :</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {log.bedtimeReminders.map((rTime, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-[#252830] border border-[#343740] text-[#D4F63D] font-mono font-bold text-xs"
                      >
                        {rTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ENCART HEURE DE RÉVEIL & DURÉE DU SOMMEIL                              */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#252830] border border-[#343740] flex items-center justify-center text-[#FBBF24] shadow-sm">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Heure de réveil</h3>
              <p className="text-[11px] text-[#8E929E]">Sortie du lit ce matin</p>
            </div>
          </div>

          <input
            type="time"
            value={log.wakeTime || "07:00"}
            onChange={(e) => handleWakeTimeChange(e.target.value, true)}
            className="h-10 px-3 rounded-xl bg-[#252830] border border-[#343740] text-white font-mono font-bold text-sm focus:border-[#D4F63D] outline-none text-center cursor-pointer shadow-inner"
          />
        </div>

        {/* Quick action: Je me réveille maintenant */}
        <button
          type="button"
          onClick={handleSetWakeTimeNow}
          className="w-full py-2.5 px-3 rounded-2xl bg-[#252830] hover:bg-[#2F333E] border border-[#343740] text-[#FBBF24] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Sun className="w-4 h-4" />
          <span>Je me réveille maintenant</span>
        </button>

        {/* Conditional Sleep Duration Badge: Only shown if yesterday bedtime & today wakeTime are validated */}
        {nightSleep ? (
          <div className="p-3.5 rounded-2xl bg-[#17181D] border border-[#2B2E38] space-y-1 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4F63D]" />
                <span className="text-xs font-semibold text-[#8E929E]">Durée de sommeil :</span>
              </div>

              <span className="text-sm font-extrabold text-[#D4F63D] font-mono">
                {nightSleep.duration.text}
              </span>
            </div>

            <p className="text-[10px] text-[#6B7280]">
              Coucher hier à <strong>{nightSleep.yesterdayBedtime}</strong> → Réveil ce matin à <strong>{nightSleep.todayWakeTime}</strong>
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-[#17181D]/60 border border-[#2B2E38] flex items-center gap-2.5 text-xs text-[#8E929E]">
            <Info className="w-4 h-4 text-[#818CF8] flex-shrink-0" />
            <span className="text-[11px] leading-tight">
              La durée de sommeil s'affichera dès que le coucher d'hier soir et le réveil de ce matin seront renseignés.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. ACCÈS RAPIDE AU BILAN DU JOUR                                          */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Journal & Bilan du jour</h3>
              <p className="text-[11px] text-[#8E929E]">Gratitude, manifestations et bilan</p>
            </div>
          </div>

          <a
            href="/bilan"
            className="px-4 py-2 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#D4F63D] border border-[#343740] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <span>Ouvrir</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </div>
  );
};
