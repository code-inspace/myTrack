"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Maximize2, Pause, Play, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, formatCountdown, formatMinutes, MINUTE_MS } from "../plan";
import { overrunMs, planShrink, projectedEndMs } from "../sessionMachine";
import type { SessionAction } from "../sessionMachine";
import type { RunItem, SessionState } from "../types";
import { useWakeLock } from "../useWakeLock";

type DispatchAction = SessionAction extends infer A ? (A extends { now: number } ? Omit<A, "now"> : never) : never;

interface SessionRunnerProps {
  state: SessionState;
  now: number;
  current: RunItem | null;
  warning: boolean;
  remaining: number;
  dispatch: (action: DispatchAction) => void;
  onClose: () => void;
}

const RING_RADIUS = 120;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

export const SessionRunner: React.FC<SessionRunnerProps> = ({
  state,
  now,
  current,
  warning,
  remaining,
  dispatch,
  onClose,
}) => {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [dismissedOverrun, setDismissedOverrun] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const running = state.status === "running";
  useWakeLock(running);

  const next = useMemo(
    () => state.items.slice(state.index + 1).find((i) => i.kind === "task") ?? null,
    [state.items, state.index],
  );
  const isBreak = current?.kind === "break";
  const overtime = remaining < 0;
  const plannedMs = current?.plannedMs ?? 1;
  const progress = overtime ? 1 : Math.min(1, Math.max(0, 1 - remaining / plannedMs));

  // Haptics + announcements at the 5-minute warning and when time is up
  const warnedFor = useRef<string | null>(null);
  const overFor = useRef<string | null>(null);
  useEffect(() => {
    if (!current) return;
    if (warning && warnedFor.current !== current.id) {
      warnedFor.current = current.id;
      vibrate([200, 100, 200]);
    }
    if (overtime && overFor.current !== current.id) {
      overFor.current = current.id;
      vibrate([400, 200, 400, 200, 400]);
    }
  }, [warning, overtime, current]);

  // What screen readers hear: minute by minute (never second by second), more urgent near the end
  const minutesLeft = Math.max(0, Math.ceil(remaining / MINUTE_MS));
  const announce = !running
    ? ""
    : overtime
      ? isBreak
        ? "La pause est terminée"
        : "Le temps est écoulé"
      : warning
        ? `Plus que ${Math.max(1, minutesLeft)} minute${minutesLeft > 1 ? "s" : ""}`
        : minutesLeft > 0 && minutesLeft % 5 === 0
          ? `Il reste ${minutesLeft} minutes`
          : "";

  // Overrun: only the user decides between moving the end and shrinking what follows
  const overrun = running ? overrunMs(state, now) : 0;
  const overrunMinutes = Math.ceil(overrun / MINUTE_MS);
  const showChoice = running && overrun >= 30_000 && dismissedOverrun !== overrunMinutes;
  const shrink = useMemo(() => (showChoice ? planShrink(state, now) : null), [showChoice, state, now]);
  const projectedEnd = projectedEndMs(state, now);

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const accent = overtime ? "#F87171" : warning ? "#FBBF24" : current?.color || "#D4F63D";
  const taskItems = state.items.filter((i) => i.kind === "task");

  // ---------- Summary ----------
  if (!running) {
    return (
      <div ref={rootRef} aria-label="Fin de session" className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[#0B0C0F] px-5 py-8 text-white">
        <div className="mx-auto w-full max-w-md space-y-5">
          <h1 className="text-2xl font-extrabold">{state.status === "finished" ? "Session terminée 🎉" : "Session arrêtée"}</h1>
          <ul className="space-y-2" aria-label="Bilan de la session">
            {taskItems.map((item) => {
              const planned = Math.round(item.plannedMs / MINUTE_MS);
              const actual = Math.round(item.actualMs / MINUTE_MS);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#282A30] bg-[#17181D] px-4 py-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      item.state === "done" ? "bg-[#D4F63D] text-black" : "bg-[#252830] text-[#8E929E]",
                    )}
                    aria-hidden="true"
                  >
                    {item.state === "done" ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
                  <span className="text-sm text-[#8E929E]">
                    {item.state === "done" ? `${formatMinutes(actual)} / ${formatMinutes(planned)}` : item.state === "skipped" ? "passée" : "non commencée"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-[#8E929E]">Les tâches terminées sont validées dans ton agenda avec le temps réellement passé.</p>
          <button
            type="button"
            onClick={onClose}
            className="h-14 w-full rounded-2xl bg-[#D4F63D] text-base font-extrabold text-black cursor-pointer hover:bg-[#c5e636]"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  // ---------- Timer ----------
  return (
    <div ref={rootRef} aria-label="Minuteur de session" className="fixed inset-0 z-[70] flex flex-col bg-[#0B0C0F] text-white">
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* Top bar: progress through the session */}
      <header className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <ol className="flex min-w-0 flex-1 gap-1.5" aria-label="Avancement de la session">
          {taskItems.map((item) => (
            <li
              key={item.id}
              aria-label={`${item.title} : ${item.state === "done" ? "terminée" : item.id === current?.id ? "en cours" : item.state === "skipped" ? "passée" : "à venir"}`}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                item.state === "done" ? "bg-[#D4F63D]" : item.id === current?.id ? "bg-white/70" : "bg-white/15",
              )}
            />
          ))}
        </ol>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Plein écran"
          className="hidden rounded-full p-2 text-[#8E929E] hover:text-white md:block cursor-pointer"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmQuit(true)}
          aria-label="Quitter la session"
          className="rounded-full p-2 text-[#8E929E] hover:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="px-5 pt-2 text-center text-sm text-[#8E929E]">
        Fin prévue à <strong className="text-white">{formatClock(state.sessionEndMs)}</strong>
        {overrun >= 60_000 && <span className="ml-1 text-amber-300">(+{overrunMinutes} min prévues)</span>}
      </div>

      {/* Ring + countdown */}
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5">
        {warning && !state.paused && (
          <p role="alert" className="rounded-full bg-amber-400/15 px-4 py-1.5 text-base font-extrabold text-amber-300 motion-safe:animate-pulse">
            Plus que 5 minutes
          </p>
        )}
        {overtime && (
          <p role="alert" className="rounded-full bg-red-400/15 px-4 py-1.5 text-base font-extrabold text-red-300">
            {isBreak ? "La pause est terminée" : "Temps écoulé"}
          </p>
        )}

        <div className="relative aspect-square w-[min(82vw,52vh,380px)]" role="timer" aria-label={`${current?.title}, ${overtime ? "dépassé de" : "reste"} ${formatCountdown(remaining)}`}>
          <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="140" cy="140" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              stroke={accent}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              style={{ transition: "stroke 0.3s" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="line-clamp-2 text-lg font-bold" style={{ color: accent }}>
              {isBreak ? "Pause" : current?.title}
            </span>
            <span className={cn("font-mono text-[clamp(2.75rem,14vw,5rem)] font-extrabold leading-none tabular-nums", overtime && "text-red-300")}>
              {overtime ? "+" : ""}
              {formatCountdown(remaining)}
            </span>
            <span className="mt-1 text-sm text-[#8E929E]">
              {state.paused ? "En pause" : `sur ${formatMinutes(Math.round(plannedMs / MINUTE_MS))}`}
            </span>
          </div>
        </div>

        {/* Add time */}
        <div className="flex items-center gap-2" role="group" aria-label="Ajouter du temps">
          {[2, 5, 10].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => dispatch({ type: "extend", minutes: m })}
              className="h-12 min-w-[72px] rounded-2xl border border-[#343740] bg-[#17181D] text-base font-bold text-white hover:bg-[#22242B] active:scale-95 cursor-pointer"
            >
              +{m} min
            </button>
          ))}
        </div>

        {/* Main controls */}
        <div className="flex w-full max-w-sm items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: state.paused ? "resume" : "pause" })}
            aria-label={state.paused ? "Reprendre" : "Pause"}
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-[#343740] bg-[#17181D] text-white hover:bg-[#22242B] cursor-pointer"
          >
            {state.paused ? <Play className="h-6 w-6 fill-current" /> : <Pause className="h-6 w-6 fill-current" />}
          </button>
          <button
            type="button"
            data-testid="session-finish"
            onClick={() => dispatch({ type: "finish" })}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#D4F63D] text-base font-extrabold text-black hover:bg-[#c5e636] active:scale-[0.98] cursor-pointer"
          >
            <Check className="h-5 w-5 stroke-[3]" />
            {isBreak ? "Reprendre le travail" : next ? "Terminé, suivant" : "Terminé"}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "skip" })}
            aria-label={isBreak ? "Passer la pause" : "Passer cette tâche"}
            title={isBreak ? "Passer la pause" : "Passer cette tâche sans la valider"}
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-[#343740] bg-[#17181D] text-white hover:bg-[#22242B] cursor-pointer"
          >
            <SkipForward className="h-6 w-6" />
          </button>
        </div>
      </main>

      <footer className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] text-center text-sm text-[#8E929E]">
        {next ? (
          <span className="inline-flex items-center gap-1.5">
            Ensuite <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <strong className="text-white">{next.title}</strong> · {formatMinutes(Math.round(next.plannedMs / MINUTE_MS))}
          </span>
        ) : (
          "Dernière tâche de la session"
        )}
      </footer>

      {/* Overrun: an informed choice */}
      {showChoice && shrink && (
        <div role="alertdialog" aria-modal="true" aria-label="Dépassement de la session" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 md:items-center">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-[#343740] bg-[#17181D] p-5 shadow-2xl">
            <div>
              <h2 className="text-lg font-extrabold text-white">Tu vas dépasser de {formatMinutes(overrunMinutes)}</h2>
              <p className="mt-1 text-sm text-[#8E929E]">
                À ce rythme, la session finirait à <strong className="text-white">{formatClock(projectedEnd)}</strong> au lieu de{" "}
                <strong className="text-white">{formatClock(state.sessionEndMs)}</strong>. Que veux-tu faire ?
              </p>
            </div>

            <button
              type="button"
              data-testid="session-shift-end"
              onClick={() => dispatch({ type: "shift_end" })}
              className="w-full rounded-2xl border border-[#343740] bg-[#1C1D22] p-4 text-left hover:border-[#D4F63D]/60 cursor-pointer"
            >
              <div className="font-bold text-white">Décaler la fin</div>
              <div className="mt-0.5 text-sm text-[#8E929E]">
                La session finit à {formatClock(projectedEnd)} ; les tâches suivantes gardent leur durée.
              </div>
            </button>

            <button
              type="button"
              data-testid="session-shrink"
              onClick={() => dispatch({ type: "shrink" })}
              disabled={shrink.changes.length === 0}
              className="w-full rounded-2xl border border-[#343740] bg-[#1C1D22] p-4 text-left hover:border-[#D4F63D]/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="font-bold text-white">Réduire la suite</div>
              {shrink.changes.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-sm text-[#8E929E]">
                  {shrink.changes.map((c) => (
                    <li key={c.itemId}>
                      {c.title} : {c.fromMinutes} → <strong className="text-white">{c.toMinutes} min</strong>
                    </li>
                  ))}
                  {shrink.remainingOverflowMs > 0 && (
                    <li className="text-amber-300">
                      Insuffisant : la fin sera quand même décalée de {formatMinutes(Math.ceil(shrink.remainingOverflowMs / MINUTE_MS))}.
                    </li>
                  )}
                </ul>
              ) : (
                <div className="mt-0.5 text-sm text-[#8E929E]">Les tâches suivantes sont déjà au minimum (5 min).</div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDismissedOverrun(overrunMinutes)}
              className="w-full rounded-2xl py-2.5 text-sm font-semibold text-[#8E929E] hover:text-white cursor-pointer"
            >
              Décider plus tard
            </button>
          </div>
        </div>
      )}

      {confirmQuit && (
        <div role="alertdialog" aria-modal="true" aria-label="Quitter la session" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-[#343740] bg-[#17181D] p-5">
            <h2 className="text-lg font-extrabold">Quitter la session ?</h2>
            <p className="text-sm text-[#8E929E]">Les tâches déjà terminées restent validées. Les autres restent planifiées dans ton agenda.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmQuit(false)}
                className="h-11 flex-1 rounded-2xl bg-[#252830] font-bold text-white cursor-pointer"
              >
                Continuer
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmQuit(false);
                  dispatch({ type: "cancel" });
                }}
                className="h-11 flex-1 rounded-2xl bg-red-600 font-bold text-white cursor-pointer"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
