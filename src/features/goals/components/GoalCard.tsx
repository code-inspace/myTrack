"use client";

import React, { useState } from "react";
import { Goal, GoalProgressResult } from "../types";
import { Project } from "@/features/projects/types";
import { Period } from "@/features/dashboard/types";
import type { GoalPace } from "@/features/bilan/insights";
import { formatMinutes } from "@/features/session/plan";
import {
  Target,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Repeat,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

/** Pace status as text + icon (never color alone) */
const PACE_BADGE: Record<string, { label: string; className: string; icon: React.ElementType } | undefined> = {
  ahead: { label: "En avance", className: "text-[#D4F63D] border-[#D4F63D]/30 bg-[#D4F63D]/10", icon: TrendingUp },
  on_track: { label: "En bonne voie", className: "text-[#D1D5DB] border-white/15 bg-white/5", icon: Clock },
  behind: { label: "En retard", className: "text-amber-300 border-amber-400/30 bg-amber-400/10", icon: AlertTriangle },
  missed: { label: "Manqué", className: "text-red-300 border-red-400/30 bg-red-400/10", icon: AlertTriangle },
};

interface GoalCardProps {
  goal: Goal;
  progress: GoalProgressResult;
  project?: Project | null;
  period: Period;
  /** Where the goal stands against the time elapsed (shown as a status and a marker on the bar) */
  pace?: GoalPace;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  progress,
  project,
  period,
  pace,
  onEdit,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const projectColor = goal.color || project?.color || "#D4F63D";
  const projectName = project?.name || "Projet";
  const isRecurring = goal.isRecurring !== false && (!goal.periodKey || goal.isRecurring);
  const targetCategories =
    Array.isArray(goal.projectCategories) && goal.projectCategories.length > 0
      ? goal.projectCategories
      : goal.projectCategory
      ? [goal.projectCategory]
      : [];

  // Clamped percentage for the fill width
  const fillPercentage = Math.min(100, progress.percentage);

  return (
    <div className="bg-[#141519] border border-[#23252E] hover:border-[#2F323E] rounded-3xl p-4 md:p-5 shadow-lg relative overflow-hidden transition-all group">
      {/* Subtle background glow when completed */}
      {progress.isCompleted && (
        <div
          className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: projectColor }}
        />
      )}

      {/* 1. Header: Project & Subcategory Info + Action Menu */}
      <div className="flex items-start justify-between gap-3 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white/10"
            style={{
              backgroundColor: `${projectColor}20`,
              color: projectColor,
            }}
          >
            <Target className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white truncate">
                {goal.title || projectName}
              </span>

              {isRecurring && (
                <span
                  title="Objectif récurrent"
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#232634] text-[#A5B4FC] border border-[#3730A3]/30 shrink-0"
                >
                  <Repeat className="w-2.5 h-2.5" />
                </span>
              )}

              {targetCategories.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {targetCategories.map((cat) => (
                    <span
                      key={cat}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-white/10"
                      style={{
                        backgroundColor: `${projectColor}15`,
                        color: projectColor,
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#8E929E] mt-0.5 flex items-center gap-1.5 truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: projectColor }}
              />
              <span className="truncate">{projectName}</span>
              <span>•</span>
              <span className="capitalize">
                {goal.periodType === "day"
                  ? isRecurring ? "Chaque jour" : "Objectif Jour"
                  : goal.periodType === "week"
                  ? isRecurring ? "Chaque semaine" : "Objectif Semaine"
                  : isRecurring ? "Chaque mois" : "Objectif Mois"}
              </span>
              <span>•</span>
              <span className="text-[#8E929E] font-medium">
                {goal.targetType === "count" ? "Séances" : "Temps"}
              </span>
            </p>
          </div>
        </div>

        {/* Action Menu button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="w-8 h-8 rounded-xl bg-[#1C1D24] hover:bg-[#252832] border border-[#2B2E3C] text-[#8E929E] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Options de l'objectif"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-10 w-36 bg-[#1A1C24] border border-[#2D303E] rounded-2xl shadow-xl py-1.5 z-30 flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(goal);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-white hover:bg-[#252834] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#818CF8]" />
                  <span>Modifier</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(goal.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Visual Progress Stats Row */}
      <div className="flex items-baseline justify-between pt-1 pb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl md:text-2xl font-black text-white tracking-tight">
            {progress.formattedActual}
          </span>
          <span className="text-xs font-semibold text-[#8E929E]">
            réalisé / <strong className="text-white">{progress.formattedTarget}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {progress.isCompleted ? (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm"
              style={{
                backgroundColor: `${projectColor}25`,
                color: projectColor,
                border: `1px solid ${projectColor}40`,
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{progress.percentage}%</span>
            </span>
          ) : (
            <span className="text-xs font-bold text-[#8E929E]">
              {progress.percentage}%
            </span>
          )}
        </div>
      </div>

      {pace && PACE_BADGE[pace.status] && (
        <div className="pb-1.5">
          {(() => {
            const badge = PACE_BADGE[pace.status]!;
            const Icon = badge.icon;
            return (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}>
                <Icon className="h-3 w-3" aria-hidden="true" />
                {badge.label}
              </span>
            );
          })()}
        </div>
      )}

      {/* 3. The requested Goal Bar: Semi-transparent Target Bar + Solid Opaque Realized Gauge */}
      <div className="w-full py-1.5">
        <div
          className="relative w-full h-4 rounded-full overflow-hidden border transition-all"
          style={{
            backgroundColor: `${projectColor}18`, // Semi-transparent target container
            borderColor: `${projectColor}35`,
          }}
          title={`Objectif: ${progress.formattedTarget} | Réalisé: ${progress.formattedActual} (${progress.percentage}%)`}
        >
          {/* Realized Opaque Bar */}
          <div
            className="h-full rounded-full transition-all duration-500 ease-out relative"
            style={{
              width: `${fillPercentage}%`,
              backgroundColor: projectColor, // Opaque Realized progress
              boxShadow: progress.percentage > 0 ? `0 0 12px ${projectColor}80` : "none",
            }}
          >
            {/* Subtle inner highlight shine */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/20 rounded-full" />
          </div>

          {/* Where you should be by now */}
          {pace && pace.expectedPercent > 0 && pace.expectedPercent < 100 && !progress.isCompleted && (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 w-0.5 bg-white/80"
              style={{ left: `${pace.expectedPercent}%` }}
            />
          )}
        </div>
        {pace && pace.expectedPercent > 0 && pace.expectedPercent < 100 && !progress.isCompleted && (
          <p className="mt-1 text-[11px] text-[#8E929E]">
            Repère : tu devrais en être à <strong className="text-white">{pace.expectedPercent}%</strong> aujourd&apos;hui
          </p>
        )}
      </div>

      {/* 4. Bottom Contextual Footer */}
      <div className="flex items-center justify-between pt-2 text-[11px] text-[#8E929E]">
        <div className="flex items-center gap-1.5">
          {progress.targetType === "count" ? (
            <Target className="w-3.5 h-3.5 text-[#8E929E]" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-[#8E929E]" />
          )}
          <span>
            {progress.isCompleted
              ? progress.isOverachieved
                ? `Objectif dépassé (${progress.formattedActual}) !`
                : "Objectif atteint avec succès 🎉"
              : `Encore ${progress.formattedRemaining} pour valider${
                  pace && pace.perDay && pace.perDay > 0 && pace.daysLeft > 1
                    ? ` · ${pace.isCount ? `${Math.round(pace.perDay * 10) / 10} séance/jour` : `${formatMinutes(Math.ceil(pace.perDay))}/jour`}`
                    : ""
                }`}
          </span>
        </div>

        {progress.percentage >= 100 && (
          <div className="flex items-center gap-1 text-[#D4F63D] font-bold">
            <Sparkles className="w-3 h-3" />
            <span>Complété</span>
          </div>
        )}
      </div>
    </div>
  );
};
