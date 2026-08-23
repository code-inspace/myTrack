"use client";

import React, { useState, useEffect, useRef } from "react";
import { DailySleepLog } from "../types";
import {
  getStoredSleepLog,
  saveStoredSleepLog,
  computeDefaultBedtimeReminders,
  getNightSleepDuration,
} from "../actions";
import {
  Moon,
  Sun,
  BellRing,
  Plus,
  Trash2,
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

  // Synchronize state when selected date changes
  useEffect(() => {
    setLog(getStoredSleepLog(selectedDate));
    setIsSaved(false);
  }, [selectedDate]);

  const triggerSave = (updated: DailySleepLog) => {
    setLog(updated);
    saveStoredSleepLog(updated);
    setIsSaved(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setIsSaved(false), 2500);
  };

  const handleBedtimeChange = (newBedtime: string, markValidated = true) => {
    const defaultReminders = computeDefaultBedtimeReminders(newBedtime);
    const updated: DailySleepLog = {
      ...log,
      bedtime: newBedtime,
      bedtimeValidated: markValidated,
      bedtimeReminders: defaultReminders,
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

  const handleUpdateReminderTime = (index: number, newTime: string) => {
    const updatedReminders = [...(log.bedtimeReminders || [])];
    updatedReminders[index] = newTime;
    const updated: DailySleepLog = {
      ...log,
      bedtimeReminders: updatedReminders,
    };
    triggerSave(updated);
  };

  const handleAddReminder = () => {
    const reminders = log.bedtimeReminders || [];
    const lastTime = reminders[reminders.length - 1] || "22:00";
    const updated: DailySleepLog = {
      ...log,
      bedtimeReminders: [...reminders, lastTime],
    };
    triggerSave(updated);
  };

  const handleRemoveReminder = (index: number) => {
    const reminders = log.bedtimeReminders || [];
    const updatedReminders = reminders.filter((_, idx) => idx !== index);
    const updated: DailySleepLog = {
      ...log,
      bedtimeReminders: updatedReminders,
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
      {/* 1. ENCART HEURE DE COUCHER & RAPPELS (3 RAPPELS PAR DÉFAUT)                */}
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

        {/* Rappels de coucher configurables */}
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
            <div className="space-y-2 pt-1 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[11px] text-[#8E929E] px-1">
                <span>Rappels programmés ({log.bedtimeReminders?.length || 0}) :</span>
                <button
                  type="button"
                  onClick={handleAddReminder}
                  className="text-[#D4F63D] font-bold hover:underline flex items-center gap-1 cursor-pointer bg-[#252830] px-2 py-0.5 rounded-lg border border-[#343740]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Ajouter</span>
                </button>
              </div>

              <div className="space-y-2">
                {(log.bedtimeReminders || []).map((rTime, idx) => {
                  const label =
                    idx === 0
                      ? "1h avant"
                      : idx === 1
                      ? "30 min avant"
                      : idx === 2
                      ? "15 min avant"
                      : `Rappel ${idx + 1}`;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-[#252830]/80 border border-[#343740]"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#8E929E]" />
                        <span className="text-xs font-semibold text-[#D1D5DB]">
                          {label} :
                        </span>
                        <input
                          type="time"
                          value={rTime}
                          onChange={(e) => handleUpdateReminderTime(idx, e.target.value)}
                          className="h-8 px-2 rounded-lg bg-[#1C1D22] border border-[#3A3E4B] text-white font-mono font-bold text-xs focus:border-[#D4F63D] outline-none text-center cursor-pointer"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveReminder(idx)}
                        disabled={(log.bedtimeReminders?.length || 0) <= 1}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          (log.bedtimeReminders?.length || 0) > 1
                            ? "text-[#8E929E] hover:text-red-400 hover:bg-[#1C1D22] cursor-pointer"
                            : "text-[#4B5563] cursor-not-allowed opacity-30"
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
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
      {/* 3. ENCART COMMENTAIRE DE LA JOURNÉE (JOURNAL & BILAN)                     */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#252830] border border-[#343740] flex items-center justify-center text-[#60A5FA] shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Commentaire de la journée</h3>
            <p className="text-[11px] text-[#8E929E]">Notes, ressenti, apprentissages et victoires</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={4}
            value={log.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Comment s'est passée ta journée ? Qu'as-tu accompli, comment te sens-tu ?"
            className="w-full p-4 rounded-2xl bg-[#252830] border border-[#343740] text-sm text-white focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] outline-none placeholder-[#6B7280] resize-none transition-all"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => triggerSave(log)}
            className="px-4 py-2 rounded-xl bg-[#D4F63D] hover:bg-[#c2e432] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Enregistrer le bilan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
