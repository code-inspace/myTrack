"use client";

import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useGoals } from "@/features/goals/hooks";
import { useProjectMutations } from "@/features/projects/hooks";
import { DEFAULT_PROJECT_COLUMNS, type Project } from "@/features/projects/types";

/** Category of the tasks logged by +1, matched by result goals */
export const RESULT_CATEGORY = "Résultat";

interface Domain {
  name: string;
  color: string;
  hours: number;
  /** Comma separated sub-categories that all count toward this one target (optional) */
  categories: string;
  /** Optional weekly result target (applications sent, chapters done…), counted with +1 */
  results: number;
  enabled: boolean;
}

const INITIAL: Domain[] = [
  { name: "Recherche d'emploi", color: "#D4F63D", hours: 25, categories: "Postuler, Formation, Entretiens", results: 8, enabled: true },
  { name: "Révisions", color: "#60A5FA", hours: 10, categories: "", results: 0, enabled: false },
  { name: "Travail", color: "#A78BFA", hours: 20, categories: "", results: 0, enabled: false },
  { name: "Maison", color: "#F59E0B", hours: 5, categories: "", results: 0, enabled: false },
];

/**
 * First-run setup: one project per domain and a recurring weekly target for each, in one step.
 * Existing projects with the same name are reused, never duplicated.
 */
export const SetupDomains: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const [domains, setDomains] = useState<Domain[]>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createProject } = useProjectMutations();
  const { createGoal } = useGoals();

  const patch = (index: number, update: Partial<Domain>) =>
    setDomains((prev) => prev.map((d, i) => (i === index ? { ...d, ...update } : d)));

  const chosen = domains.filter((d) => d.enabled && d.name.trim() && d.hours > 0);

  const save = async () => {
    if (chosen.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      for (const domain of chosen) {
        const name = domain.name.trim();
        const existing = projects.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
        const categories = domain.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const project =
          existing ??
          (await createProject.mutateAsync({
            name,
            color: domain.color,
            columns: DEFAULT_PROJECT_COLUMNS,
            categories,
          }));
        await createGoal({
          projectId: project.id,
          ...(categories.length > 0 ? { title: name, projectCategory: categories[0], projectCategories: categories } : {}),
          periodType: "week",
          isRecurring: true,
          targetType: "duration",
          targetMinutes: Math.round(domain.hours * 60),
          color: project.color || domain.color,
        });
        if (domain.results > 0) {
          // Results live in their own category so +1 never inflates the time target
          await createGoal({
            projectId: project.id,
            title: `${name} — résultats`,
            projectCategory: RESULT_CATEGORY,
            projectCategories: [RESULT_CATEGORY],
            periodType: "week",
            isRecurring: true,
            targetType: "count",
            targetMinutes: 0,
            targetCount: Math.round(domain.results),
            unit: "séance",
            color: project.color || domain.color,
          });
        }
      }
    } catch (err) {
      console.warn("setup domains error:", err);
      setError("Une étape a échoué. Réessaie : les projets déjà créés seront réutilisés.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="setup-title" className="space-y-4 rounded-3xl border border-[#D4F63D]/30 bg-[#141519] p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#D4F63D]" aria-hidden="true" />
        <div>
          <h2 id="setup-title" className="text-base font-extrabold text-white">
            Configure tes domaines en 1 minute
          </h2>
          <p className="mt-0.5 text-xs text-[#8E929E]">
            Un projet et une cible par semaine pour chacun. Tu pourras tout modifier ensuite.
          </p>
        </div>
      </div>

      <ul className="space-y-2.5">
        {domains.map((d, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2.5">
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => patch(i, { enabled: e.target.checked })}
              aria-label={`Inclure ${d.name || "ce domaine"}`}
              className="h-5 w-5 flex-shrink-0 cursor-pointer accent-[#D4F63D]"
            />
            <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
            <input
              type="text"
              value={d.name}
              onChange={(e) => patch(i, { name: e.target.value })}
              aria-label={`Nom du domaine ${i + 1}`}
              className="min-w-0 flex-1 rounded-xl border border-[#343740] bg-[#0E0F12] px-3 py-2.5 text-sm text-white"
            />
            <label className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[#8E929E]">
              <input
                type="number"
                inputMode="decimal"
                min={0.5}
                max={80}
                step={0.5}
                value={d.hours || ""}
                onChange={(e) => patch(i, { hours: Number(e.target.value) })}
                aria-label={`Heures par semaine pour ${d.name || "ce domaine"}`}
                className="w-16 rounded-xl border border-[#343740] bg-[#0E0F12] px-2 py-2.5 text-center text-sm text-white"
              />
              h/sem
            </label>
            <label className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[#8E929E]">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                value={d.results || ""}
                placeholder="0"
                onChange={(e) => patch(i, { results: Number(e.target.value) })}
                aria-label={`Résultats par semaine pour ${d.name || "ce domaine"} (optionnel)`}
                className="w-14 rounded-xl border border-[#343740] bg-[#0E0F12] px-2 py-2.5 text-center text-sm text-white"
              />
              +1/sem
            </label>
            <input
              type="text"
              value={d.categories}
              onChange={(e) => patch(i, { categories: e.target.value })}
              placeholder="Sous-catégories qui comptent (séparées par des virgules)"
              aria-label={`Sous-catégories pour ${d.name || "ce domaine"}`}
              className="w-full rounded-xl border border-[#343740] bg-[#0E0F12] px-3 py-2 text-xs text-white placeholder:text-[#6B7280]"
            />
          </li>
        ))}
      </ul>

      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={chosen.length === 0 || saving}
        className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#D4F63D] text-sm font-extrabold text-black hover:bg-[#bce028] disabled:opacity-40"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Créer {chosen.length} domaine{chosen.length > 1 ? "s" : ""}
      </button>
    </section>
  );
};
