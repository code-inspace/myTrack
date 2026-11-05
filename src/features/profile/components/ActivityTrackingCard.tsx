"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Copy, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useProjects } from "@/features/projects/hooks";
import { cn } from "@/lib/utils";

interface ActivitySourceRow {
  id: string;
  key: string;
  project_id: string | null;
  enabled: boolean;
}

/**
 * Folders opened in Claude Code and apps that send heartbeats show up here on their first ping.
 * Each one is mapped to a project (minutes go to that project) or switched off.
 */
export const ActivityTrackingCard: React.FC = () => {
  const { projects } = useProjects();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: sources = [], error } = useQuery({
    queryKey: ["activity-sources"],
    queryFn: async () => {
      const { data, error: err } = await createClient()
        .from("activity_sources")
        .select("id, key, project_id, enabled")
        .order("key");
      if (err) throw err;
      return (data as ActivitySourceRow[]) || [];
    },
    retry: false,
  });

  const update = async (id: string, patch: Partial<ActivitySourceRow> & { task_id?: null }) => {
    queryClient.setQueryData<ActivitySourceRow[]>(["activity-sources"], (prev = []) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    await createClient()
      .from("activity_sources")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const copyConfig = async () => {
    try {
      const res = await fetch("/api/widget/token");
      if (!res.ok) return;
      const { token } = await res.json();
      const config = JSON.stringify({ url: window.location.origin, token }, null, 2);
      await navigator.clipboard.writeText(config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable: nothing to do
    }
  };

  return (
    <div className="rounded-3xl bg-[#17181F] border border-[#282B36] p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#D4F63D]/15 border border-[#D4F63D]/30 flex items-center justify-center text-[#D4F63D]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">Suivi automatique</h3>
            <p className="text-xs text-[#8E929E]">Claude Code et tes apps ajoutent le temps travaillé à leur projet</p>
          </div>
        </div>
        <button
          type="button"
          onClick={copyConfig}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20222B] border border-[#282B36] text-xs font-bold text-white whitespace-nowrap"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copié" : "Copier la config"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-amber-400">Le suivi automatique n&apos;est pas encore activé sur la base (migration 0009).</p>
      )}

      {!error && sources.length === 0 && (
        <p className="text-xs text-[#8E929E] leading-relaxed">
          Rien pour l&apos;instant. Dès que tu travailles dans un dossier avec Claude Code, il apparaît ici.
        </p>
      )}

      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="bg-[#121317] border border-[#23252E] rounded-2xl p-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-bold truncate", s.enabled ? "text-white" : "text-[#8E929E] line-through")}>
                {s.key}
              </p>
              <select
                aria-label={`Projet pour ${s.key}`}
                value={s.project_id || ""}
                disabled={!s.enabled}
                onChange={(e) => update(s.id, { project_id: e.target.value || null, task_id: null })}
                className="mt-1 w-full bg-[#20222B] border border-[#282B36] rounded-lg text-xs text-[#C5C8D4] px-2 py-1.5"
              >
                <option value="">Projet créé automatiquement</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={s.enabled}
              aria-label={`Suivre ${s.key}`}
              onClick={() => update(s.id, { enabled: !s.enabled })}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                s.enabled ? "bg-[#D4F63D]" : "bg-[#282B36]",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#111214] shadow-md transition",
                  s.enabled ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
