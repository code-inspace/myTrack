"use client";

import React from "react";
import { MomentumPoint } from "../types";

interface WaveChartProps {
  data: MomentumPoint[];
}

export const WaveChart: React.FC<WaveChartProps> = ({ data }) => {
  // If data is empty, use sample wave points
  const points =
    data && data.length >= 2
      ? data
      : [
          { date: "1", label: "5", score: 45 },
          { date: "2", label: "6", score: 30 },
          { date: "3", label: "7", score: 65 },
          { date: "4", label: "8", score: 80 },
          { date: "5", label: "9", score: 75 },
          { date: "6", label: "10", score: 40 },
          { date: "7", label: "11", score: 85 },
        ];

  const width = 340;
  const height = 110;
  const paddingX = 15;
  const paddingY = 15;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Convert points to coordinates
  const coords = points.map((p, index) => {
    const x = paddingX + (index / (points.length - 1)) * chartWidth;
    const y = height - paddingY - (p.score / 100) * chartHeight;
    return { x, y, label: p.label };
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

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-[#141518] border border-[#23242A] p-2 pt-3 my-2">
      <svg
        viewBox={`0 0 ${width} ${height + 25}`}
        className="w-full h-28 overflow-visible"
      >
        <defs>
          {/* Wave Area Glow Gradient */}
          <linearGradient id="waveFillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4F63D" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#D4F63D" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#D4F63D" stopOpacity="0.0" />
          </linearGradient>

          {/* Grid pattern */}
          <pattern id="grid" width="34" height="22" patternUnits="userSpaceOnUse">
            <path d="M 34 0 L 0 0 0 22" fill="none" stroke="#252830" strokeWidth="0.75" strokeOpacity="0.6" />
          </pattern>
        </defs>

        {/* Grid Background */}
        <rect x="0" y="0" width={width} height={height} fill="url(#grid)" />

        {/* Gradient Area Fill */}
        <path d={areaD} fill="url(#waveFillGradient)" />

        {/* Main Lime Wave Stroke */}
        <path
          d={pathD}
          fill="none"
          stroke="#D4F63D"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis tick labels */}
        {coords.map((c, idx) => (
          <text
            key={idx}
            x={c.x}
            y={height + 16}
            textAnchor="middle"
            fill="#8E929E"
            fontSize="10"
            fontWeight="600"
          >
            {c.label}
          </text>
        ))}
      </svg>
    </div>
  );
};
