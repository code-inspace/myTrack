"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Play, Timer } from "lucide-react";
import { AppHeader } from "@/components/shared/AppHeader";
import { useGoalItems, type GoalItem } from "@/features/bilan/useGoalItems";
import { goalDisplayName } from "@/features/bilan/components/GoalsTab";
import { goalsVerdict } from "@/features/bilan/insights";
import { GoalsVerdictCard } from "@/features/bilan/components/GoalsVerdictCard";
import { useQuickTimer } from "@/features/quicktimer/useQuickTimer";
import { RunningTimerCard } from "@/features/quicktimer/components/RunningTimerCard";
import { MinutesSheet } from "@/features/quicktimer/components/MinutesSheet";
import type { QuickTarget } from "@/features/quicktimer/quickTimer";
import { formatMinutes } from "@/features/session/plan";
import { useTasks } from "@/features/tasks/hooks";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { projectMinutesInRange } from "@/features/bilan/insights";
import { getTodayDateString } from "@/lib/dates";
import { SetupDomains } from "./SetupDomains";
import { useAutoActivity } from "@/features/activity/useAutoActivity";
import { AutoTrackingStrip } from "@/features/activity/AutoTrackingStrip";
import type { Project } from "@/features/projects/types";

const PACE_TEXT: Record<string, { label: string; className: string } | undefined> = {
  ahead: { label: "En avance", className: "text-[#D4F63D]" },
  on_track: { label: "Dans le rythme", className: "text-[#D1D5DB]" },
  behind: { label: "En retard", className: "text-amber-300" },
  missed: { label: "Manqué", className: "text-red-300" },
  done: { label: "Atteint", className: "text-[#D4F63D]" },
};

function targetOf(item: GoalItem): QuickTarget {
  const categories =
    Array.isArray(item.goal.projectCategories) && item.goal.projectCategories.length > 0
      ? item.goal.projectCategories
      : item.goal.projectCategory
        ? [item.goal.projectCategory]
        : [];
  return {
    key: item.goal.id,
    label: goalDisplayName(item.goal, item.project?.name),
    projectId: item.goal.projectId,
    projectCategory: categories[0] ?? null,
    color: item.goal.color || item.project?.color || null,
  };
}

function ProjectTargetRow({ project, onStart, onAdd, running }: { project: Project; onStart: () => void; onAdd: () => void; running: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[#23252E] bg-[#141519] p-3">
      <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: project.color || "#6B7280" }} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{project.name}</span>
      <ActionButtons label={project.name} running={running} onStart={onStart} onAdd={onAdd} />
    </li>
  );
}

function ActionButtons({ label, running, autoRunning, onStart, onAdd }: { label: string; running: boolean; autoRunning?: boolean; onStart: () => void; onAdd: () => void }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Ajouter du temps sur ${label}`}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[#343740] text-[#D1D5DB] hover:border-[#4A4E5C] hover:text-white"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onStart}
        disabled={running || autoRunning}
        aria-label={running ? `${label} en cours` : autoRunning ? `${label} : suivi automatique en cours` : `Démarrer le chrono ${label}`}
        className="flex h-11 min-w-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[#D4F63D] px-3 text-sm font-extrabold text-black hover:bg-[#bce028] disabled:cursor-default disabled:bg-[#D4F63D]/30 disabled:text-[#D4F63D]"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        {running ? "En cours" : autoRunning ? "Auto" : "Go"}
      </button>
    </div>
  );
}

/** Home: where do I stand this week, and one tap to start working on something. */
export const HomeScreen: React.FC = () => {
  const [reference] = useState(() => new Date());
  const { items, goals, projects, isLoading } = useGoalItems("week", reference);
  const { timer, start, record } = useQuickTimer();
  const { allTasks = [], allCompletions = [] } = useTasks(getTodayDateString());
  const { events: externalEvents = [] } = useCalendarEvents();
  const todayMinutes = useMemo(() => {
    const day = new Date();
    let total = 0;
    projectMinutesInRange({ tasks: allTasks, completions: allCompletions, externalEvents }, day, day).forEach((m) => (total += m));
    return total;
  }, [allTasks, allCompletions, externalEvents]);
  const auto = useAutoActivity();
  const liveProjectIds = new Set(auto.live.map((l) => l.projectId).filter((id): id is string => !!id));
  const [adding, setAdding] = useState<{ target: QuickTarget } | null>(null);

  const verdict = useMemo(
    () =>
      goalsVerdict(
        items.map(({ goal, project, pace }) => ({
          goalId: goal.id,
          name: goalDisplayName(goal, project?.name),
          targetType: goal.targetType === "count" ? "count" : "duration",
          pace,
        })),
      ),
    [items],
  );

  // Projects without a weekly goal still get a button: tracking must never need a goal first
  const goalProjectIds = new Set(items.map((i) => i.goal.projectId));
  const looseProjects = projects.filter((p) => !goalProjectIds.has(p.id) && !auto.sourceProjectIds.has(p.id)).slice(0, 6);
  const projectTarget = (p: Project): QuickTarget => ({ key: `project:${p.id}`, label: p.name, projectId: p.id, color: p.color });

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0E0F12]">
      <div className="z-30 flex-shrink-0 border-b border-[#23242A] bg-[#111214] shadow-md md:hidden">
        <AppHeader title="Accueil" />
      </div>

      <div className="mx-auto min-h-0 w-full max-w-md flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-28 pt-4 sm:px-4 md:max-w-3xl md:px-8 md:pb-10 md:pt-8">
        <h1 className="hidden text-2xl font-extrabold tracking-tight text-white md:block">Accueil</h1>

        <RunningTimerCard />

        {!isLoading && items.length === 0 && <SetupDomains projects={projects} />}

        <AutoTrackingStrip live={auto.live} unattached={auto.unattached} projectName={auto.projectName} />

        <p className="text-sm text-[#A1A5B3]" aria-live="polite">
          Aujourd&apos;hui :{" "}
          <strong className="text-white">{todayMinutes > 0 ? formatMinutes(todayMinutes) : "rien encore"}</strong>
          {todayMinutes === 0 && " — lance un chrono pour commencer."}
        </p>

        <GoalsVerdictCard verdict={verdict} />

        <section aria-labelledby="home-week" className="space-y-3" hidden={items.length === 0 && looseProjects.length === 0}>
          <h2 id="home-week" className="text-sm font-bold uppercase tracking-wider text-white">
            Cette semaine
          </h2>

          {(
            <ul className="space-y-3">
              {items.map((item) => {
                const target = targetOf(item);
                const isCount = item.goal.targetType === "count";
                const pace = PACE_TEXT[item.pace.status];
                const running = timer?.key === target.key;
                const autoRunning = liveProjectIds.has(item.goal.projectId);
                return (
                  <li key={item.goal.id} className="space-y-2.5 rounded-3xl border border-[#23252E] bg-[#141519] p-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-white">{target.label}</p>
                        <p className="text-xs text-[#8E929E]">
                          <strong className="text-white">{item.progress.formattedActual}</strong> / {item.progress.formattedTarget}
                          {pace && <span className={`ml-2 font-bold ${pace.className}`}>· {pace.label}</span>}
                        </p>
                      </div>
                      {isCount ? (
                        <button
                          type="button"
                          onClick={() => record(target, 1, { message: `+1 sur ${target.label}` })}
                          aria-label={`Ajouter une séance sur ${target.label}`}
                          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-2xl bg-[#D4F63D] px-4 text-sm font-extrabold text-black hover:bg-[#bce028]"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" /> 1
                        </button>
                      ) : (
                        <ActionButtons label={target.label} running={running} autoRunning={autoRunning} onStart={() => start(target)} onAdd={() => setAdding({ target })} />
                      )}
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Progression ${target.label}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, item.progress.percentage)}
                      className="relative h-2.5 overflow-hidden rounded-full bg-[#252830]"
                    >
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.progress.percentage)}%`, backgroundColor: target.color || "#D4F63D" }} />
                      {item.pace.expectedPercent > 0 && item.pace.expectedPercent < 100 && !item.progress.isCompleted && (
                        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${item.pace.expectedPercent}%` }} />
                      )}
                    </div>
                    {autoRunning && (
                      <p className="text-[11px] text-[#D4F63D]">Suivi automatique en cours : le temps se compte tout seul, pas besoin du chrono.</p>
                    )}
                    {item.pace.perDay && item.pace.perDay > 0 && item.pace.daysLeft >= 1 && !item.progress.isCompleted && (
                      <p className="text-[11px] text-[#8E929E]">
                        Encore {item.progress.formattedRemaining} — {isCount ? `${Math.round(item.pace.perDay * 10) / 10} séance/jour` : `${formatMinutes(Math.ceil(item.pace.perDay))}/jour`} pour y arriver
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {looseProjects.length > 0 && (
            <>
              {items.length > 0 && <h3 className="pt-1 text-xs font-bold uppercase tracking-wider text-[#8E929E]">Sans cible</h3>}
              <ul className="space-y-2">
                {looseProjects.map((p) => (
                  <ProjectTargetRow
                    key={p.id}
                    project={p}
                    running={timer?.key === `project:${p.id}`}
                    onStart={() => start(projectTarget(p))}
                    onAdd={() => setAdding({ target: projectTarget(p) })}
                  />
                ))}
              </ul>
            </>
          )}

          {goals.length === 0 && projects.length > 0 && (
            <p className="text-xs text-[#8E929E]">
              Fixe une cible hebdo pour voir si tu es dans le rythme :{" "}
              <Link href="/bilan?tab=objectifs" className="font-bold text-[#D4F63D] hover:underline">
                Créer un objectif
              </Link>
            </p>
          )}
        </section>

        <Link
          href="/session"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#343740] text-sm font-bold text-[#D1D5DB] hover:border-[#4A4E5C] hover:text-white"
        >
          <Timer className="h-4 w-4" aria-hidden="true" /> Planifier une session
        </Link>
      </div>

      {adding && (
        <MinutesSheet
          title={`Ajouter du temps · ${adding.target.label}`}
          description="Temps déjà travaillé, qui se termine maintenant."
          initialMinutes={60}
          confirmLabel="Ajouter"
          onConfirm={(m) => {
            const target = adding.target;
            setAdding(null);
            record(target, m);
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
};
