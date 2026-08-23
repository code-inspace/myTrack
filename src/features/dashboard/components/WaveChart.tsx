"use client";

import React, { useState } from "react";
import { MomentumPoint } from "../types";
import { Sparkles, TrendingUp, CheckCircle2, Award, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaveChartProps {
  data: MomentumPoint[];
}

export const WaveChart: React.FC<WaveChartProps> = ({ data }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<"rate" | "count">("rate");

  const points: MomentumPoint[] =
    data && data.length >= 2
      ? data
      : [
          { date: "2026-08-17", label: "Lun 17", score: 100, completedCount: 4, totalScheduled: 4 },
          { date: "2026-08-18", label: "Mar 18", score: 75, completedCount: 3, totalScheduled: 4 },
          { date: "2026-08-19", label: "Mer 19", score: 100, completedCount: 4, totalScheduled: 4 },
          { date: "2026-08-20", label: "Jeu 20", score: 50, completedCount: 2, totalScheduled: 4 },
          { date: "2026-08-21", label: "Ven 21", score: 100, completedCount: 4, totalScheduled: 4 },
          { date: "2026-08-22", label: "Sam 22", score: 75, completedCount: 3, totalScheduled: 4 },
          { date: "2026-08-23", label: "Dim 23", score: 100, completedCount: 4, totalScheduled: 4 },
        ];

  const width = 360;
  const height = 130;
  const paddingX = 24;
  const paddingY = 20;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Max value for count mode
  const maxScheduled = Math.max(...points.map((p) => p.totalScheduled || 4), 1);

  // Convert points to coordinates based on mode
  const coords = points.map((p, index) => {
    const x = paddingX + (index / (points.length - 1)) * chartWidth;
    const valueRatio = mode === "rate" ? p.score / 100 : (p.completedCount || 0) / maxScheduled;
    const y = height - paddingY - Math.max(0, Math.min(1, valueRatio)) * chartHeight;
    return { x, y, point: p };
  });

  // Build smooth cubic bezier curve
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i];
    const next = coords[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 2;
    const cpY1 = curr.y;
    const cpX2 = curr.x + (next.x - curr.x) / 2;
    const cpY2 = next.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  // Area path for gradient fill below line
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  // Selected point details (defaults to last point if none selected)
  const activePoint = selectedIdx !== null ? points[selectedIdx] : points[points.length - 1];

  return (
    <div className="w-full relative rounded-2xl bg-[#141518] border border-[#23242A] p-3 space-y-2.5">
      {/* Chart Header: Live Tooltip / Selected Point Info + Mode Toggle */}
      <div className="flex items-center justify-between pb-1">
        {/* Dynamic Detail Tooltip */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4F63D] animate-ping" />
          <div>
            <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span>{activePoint.label} :</span>
              <span className="text-[#D4F63D] font-mono">{activePoint.score}%</span>
            </div>
            <div className="text-[10px] text-[#8E929E]">
              {activePoint.completedCount} sur {activePoint.totalScheduled} tâche{activePoint.totalScheduled > 1 ? "s" : ""} validée{activePoint.completedCount > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* View Mode Toggle: % vs Volume */}
        <div className="flex items-center p-0.5 bg-[#1C1D22] border border-[#282A30] rounded-xl text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMode("rate")}
            className={cn(
              "px-2 py-1 rounded-lg transition-all cursor-pointer",
              mode === "rate"
                ? "bg-[#D4F63D] text-black shadow-sm"
                : "text-[#8E929E] hover:text-white"
            )}
          >
            % Taux
          </button>
          <button
            type="button"
            onClick={() => setMode("count")}
            className={cn(
              "px-2 py-1 rounded-lg transition-all cursor-pointer",
              mode === "count"
                ? "bg-[#D4F63D] text-black shadow-sm"
                : "text-[#8E929E] hover:text-white"
            )}
          >
            Nb Tâches
          </button>
        </div>
      </div>

      {/* SVG Interactive Curve */}
      <div className="w-full relative">
        <svg
          viewBox={`0 0 ${width} ${height + 22}`}
          className="w-full h-32 overflow-visible select-none"
        >
          <defs>
            {/* Wave Area Glow Gradient */}
            <linearGradient id="waveFillGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4F63D" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#D4F63D" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#D4F63D" stopOpacity="0.0" />
            </linearGradient>

            {/* Subtle Horizontal grid lines */}
            <pattern id="gridPattern" width={width} height={chartHeight / 2} patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2={width} y2="0" stroke="#252830" strokeWidth="0.75" strokeDasharray="3,3" />
            </pattern>
          </defs>

          {/* Grid Guideline Background */}
          <rect x="0" y={paddingY} width={width} height={chartHeight} fill="url(#gridPattern)" />

          {/* Y-Axis Guide Labels */}
          <text x={paddingX - 6} y={paddingY + 3} textAnchor="end" fill="#6B7280" fontSize="8" fontWeight="bold">
            {mode === "rate" ? "100%" : maxScheduled}
          </text>
          <text x={paddingX - 6} y={paddingY + chartHeight / 2 + 3} textAnchor="end" fill="#6B7280" fontSize="8" fontWeight="bold">
            {mode === "rate" ? "50%" : Math.round(maxScheduled / 2)}
          </text>
          <text x={paddingX - 6} y={height - paddingY + 3} textAnchor="end" fill="#6B7280" fontSize="8" fontWeight="bold">
            0
          </text>

          {/* Gradient Area Fill */}
          <path d={areaD} fill="url(#waveFillGradient)" />

          {/* Main Neon Lime Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#D4F63D"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Nodes / Circles */}
          {coords.map((c, idx) => {
            const isHovered = selectedIdx === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
              >
                {/* Vertical Cursor Guide when selected */}
                {isHovered && (
                  <line
                    x1={c.x}
                    y1={paddingY}
                    x2={c.x}
                    y2={height - paddingY}
                    stroke="#D4F63D"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    strokeOpacity="0.7"
                  />
                )}

                {/* Outer Glow Circle */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 7 : 4.5}
                  fill="#141518"
                  stroke="#D4F63D"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* Inner Dot */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 3.5 : 2}
                  fill="#D4F63D"
                />

                {/* X-axis tick labels */}
                <text
                  x={c.x}
                  y={height + 14}
                  textAnchor="middle"
                  fill={isHovered ? "#D4F63D" : "#8E929E"}
                  fontSize="9.5"
                  fontWeight={isHovered ? "bold" : "600"}
                >
                  {c.point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
