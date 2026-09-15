"use client";

import React from "react";
import { useProjects } from "@/features/projects/hooks";
import { Task } from "@/features/tasks/types";
import { FolderKanban, ChevronRight, PieChart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardProjectStatsWidgetProps {
  tasks: Task[];
}

function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

export const DashboardProjectStatsWidget: React.FC<DashboardProjectStatsWidgetProps> = ({ tasks }) => {
  const { projects } = useProjects();

  const projectTasks = tasks.filter((t) => Boolean(t.projectId) && !t.isArchived);
  const total = projectTasks.length;

  const projectData = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id && !t.isArchived);
    return {
      id: p.id,
      name: p.name,
      count: pTasks.length,
      color: p.color || "#D4F63D",
    };
  });

  let cumulativePercent = 0;

  return (
    <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#D4F63D]" />
          <h3 className="text-sm font-bold text-white">Répartition des Projets</h3>
        </div>
        <Link
          href="/projects"
          className="text-xs text-[#8E929E] hover:text-[#D4F63D] flex items-center gap-1 transition-colors"
        >
          <span>Voir tout</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="py-6 text-center text-xs text-[#8E929E]">
          Aucun projet créé pour l&apos;instant.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Mini Donut Chart */}
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full -rotate-90">
              {total === 0 ? (
                <circle cx="0" cy="0" r="0.8" fill="transparent" stroke="#282A30" strokeWidth="0.3" />
              ) : (
                projectData.map((slice) => {
                  if (slice.count === 0) return null;
                  const percent = slice.count / total;
                  const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                  cumulativePercent += percent;
                  const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                  const isLargeArc = percent > 0.5 ? 1 : 0;

                  if (percent >= 0.999) {
                    return (
                      <circle
                        key={slice.id}
                        cx="0"
                        cy="0"
                        r="0.8"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="0.3"
                      />
                    );
                  }

                  const pathData = [
                    `M ${startX * 0.95} ${startY * 0.95}`,
                    `A 0.95 0.95 0 ${isLargeArc} 1 ${endX * 0.95} ${endY * 0.95}`,
                    `L ${endX * 0.65} ${endY * 0.65}`,
                    `A 0.65 0.65 0 ${isLargeArc} 0 ${startX * 0.65} ${startY * 0.65}`,
                    "Z",
                  ].join(" ");

                  return <path key={slice.id} d={pathData} fill={slice.color} />;
                })
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-extrabold text-white leading-none">{total}</span>
              <span className="text-[10px] text-[#8E929E]">tâche{total !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Project Legend List */}
          <div className="flex-1 w-full space-y-2">
            {projectData.slice(0, 4).map((p) => {
              const percent = total > 0 ? Math.round((p.count / total) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-white truncate font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[#8E929E] font-semibold">{p.count}</span>
                    <span className="text-[10px] text-[#6B7280] w-7 text-right">{percent}%</span>
                  </div>
                </div>
              );
            })}
            {projects.length > 4 && (
              <div className="text-[10px] text-[#6B7280] pt-1">
                + {projects.length - 4} autre{projects.length - 4 > 1 ? "s" : ""} projet{projects.length - 4 > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
