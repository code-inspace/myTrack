"use client";

import React from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import type { AutoSource, LiveAutoSession } from "./useAutoActivity";

/**
 * Time that tracks itself, next to the manual timer: what is counting right now, and which
 * sources still count toward no domain (so no weekly target) — with a way to fix it.
 */
export const AutoTrackingStrip: React.FC<{
  live: LiveAutoSession[];
  unattached: AutoSource[];
  projectName: Map<string, string>;
}> = ({ live, unattached, projectName }) => {
  if (live.length === 0 && unattached.length === 0) return null;
  return (
    <section aria-labelledby="auto-tracking" className="space-y-2 rounded-3xl border border-[#23252E] bg-[#141519] p-4">
      <h2 id="auto-tracking" className="flex items-center gap-2 text-sm font-bold text-white">
        <Activity className="h-4 w-4 text-[#D4F63D]" aria-hidden="true" /> Suivi automatique
      </h2>
      {live.map((s) => (
        <p key={s.key} className="flex items-center gap-2 text-sm text-[#D1D5DB]">
          <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-[#D4F63D]" aria-hidden="true" />
          <span className="min-w-0 truncate">
            <strong className="text-white">{s.key}</strong>
            {s.projectId && projectName.get(s.projectId) ? ` → ${projectName.get(s.projectId)}` : ""}
            <span className="text-[#8E929E]"> · {s.origin === "claude-code" ? "Claude Code" : "app"} en cours</span>
          </span>
        </p>
      ))}
      {unattached.length > 0 && (
        <p className="text-xs text-amber-300">
          {unattached.length === 1 ? (
            <>
              <strong>{unattached[0].key}</strong> ne compte dans aucun domaine.
            </>
          ) : (
            <>
              <strong>{unattached.length} sources</strong> ne comptent dans aucun domaine.
            </>
          )}{" "}
          <Link href="/profile" className="font-bold underline">
            Les rattacher à un projet
          </Link>
        </p>
      )}
    </section>
  );
};
