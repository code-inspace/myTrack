"use client";

import React, { useState, useEffect, useRef } from "react";
import { DailySleepLog } from "../types";
import {
  getStoredSleepLog,
  fetchDbSleepLog,
  saveStoredSleepLog,
} from "../actions";
import {
  Sparkles,
  Heart,
  BookOpen,
  Check,
  Calendar,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/dates";

interface DailyBilanViewProps {
  selectedDate: string;
}

export const DailyBilanView: React.FC<DailyBilanViewProps> = ({ selectedDate }) => {
  const [log, setLog] = useState<DailySleepLog>(() => getStoredSleepLog(selectedDate));
  const [isSaved, setIsSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize state from Supabase / localStorage when selected date changes
  useEffect(() => {
    // 1. Instant local render
    setLog(getStoredSleepLog(selectedDate));
    setIsSaved(false);

    // 2. Fetch fresh database record from Supabase
    fetchDbSleepLog(selectedDate).then((remoteLog) => {
      if (remoteLog) {
        setLog(remoteLog);
      }
    });
  }, [selectedDate]);

  const triggerSave = (updated: DailySleepLog) => {
    setLog(updated);
    saveStoredSleepLog(updated);
    setIsSaved(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setIsSaved(false), 2500);
  };

  const handleFieldChange = (field: "gratitude" | "manifestation" | "notes", value: string) => {
    const updated: DailySleepLog = {
      ...log,
      [field]: value,
    };
    setLog(updated);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveStoredSleepLog(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-36 space-y-4 max-w-md mx-auto w-full">
      {/* Header with Save Confirmation & Formatted Date */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Journal & Bilan</h2>
          <p className="text-xs text-[#8E929E] flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3 h-3 text-[#D4F63D]" />
            <span>{formatDisplayDate(selectedDate)}</span>
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4F63D]/15 border border-[#D4F63D]/40 text-[#D4F63D] text-xs font-bold animate-in fade-in duration-200">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Enregistré</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ENCART GRATITUDE                                                       */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EC4899]/15 border border-[#EC4899]/30 flex items-center justify-center text-[#F472B6] shadow-sm">
            <Heart className="w-5 h-5 fill-[#EC4899]/20" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Gratitude du jour</span>
            </h3>
            <p className="text-[11px] text-[#8E929E]">Ce pour quoi tu es reconnaissant(e)</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={log.gratitude || ""}
            onChange={(e) => handleFieldChange("gratitude", e.target.value)}
            placeholder="Ex : Je suis reconnaissant(e) pour le temps passé avec mes proches, cette séance d'entraînement réussie, cette opportunité..."
            className="w-full p-4 rounded-2xl bg-[#252830] border border-[#343740] text-sm text-white focus:border-[#EC4899] focus:ring-1 focus:ring-[#EC4899] outline-none placeholder-[#6B7280] resize-none transition-all"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ENCART MANIFESTATION & INTENTIONS                                      */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Manifestation & Intentions</span>
            </h3>
            <p className="text-[11px] text-[#8E929E]">Visualise ta réussite et affirme tes objectifs</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={log.manifestation || ""}
            onChange={(e) => handleFieldChange("manifestation", e.target.value)}
            placeholder="Ex : J'attire la clarté et l'énergie nécessaire pour accomplir mes projets. Je progresse chaque jour vers..."
            className="w-full p-4 rounded-2xl bg-[#252830] border border-[#343740] text-sm text-white focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] outline-none placeholder-[#6B7280] resize-none transition-all"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ENCART COMMENTAIRE DE LA JOURNÉE / BILAN                               */}
      {/* ========================================================================= */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#60A5FA] shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Bilan & Victoires de la journée</span>
            </h3>
            <p className="text-[11px] text-[#8E929E]">Ressenti, apprentissages, victoires et ajustements</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={4}
            value={log.notes || ""}
            onChange={(e) => handleFieldChange("notes", e.target.value)}
            placeholder="Comment s'est passée ta journée ? Qu'as-tu accompli, quelles leçons en tires-tu ?"
            className="w-full p-4 rounded-2xl bg-[#252830] border border-[#343740] text-sm text-white focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] outline-none placeholder-[#6B7280] resize-none transition-all"
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => triggerSave(log)}
            className="px-5 py-2.5 rounded-xl bg-[#D4F63D] hover:bg-[#c2e432] text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Enregistrer le bilan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
