"use client";

import React from "react";
import { TrendingUp, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface MomentumGaugeProps {
  score: number; // 0 to 100
  delta: number; // e.g. +10
}

export const MomentumGauge: React.FC<MomentumGaugeProps> = ({
  score = 64,
  delta = 10,
}) => {
  // SVG Semi-circle gauge calculations
  const radius = 58;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // Half-circle length
  const progressClamped = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (circumference * progressClamped) / 100;

  return (
    <div className="flex items-center justify-between w-full pt-1 pb-1">
      {/* Left Context & Insight */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#8E929E]">
          <Zap className="w-3.5 h-3.5 text-[#D4F63D]" />
          <span>Indice de Régularité</span>
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight">
          Momentum
        </h2>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4F63D]/10 border border-[#D4F63D]/25 text-[#D4F63D] text-[11px] font-bold">
          <TrendingUp className="w-3 h-3" />
          <span>{delta >= 0 ? `+${delta}%` : `${delta}%`} d'efficacité</span>
        </div>
      </div>

      {/* Right Radial Gauge */}
      <div className="relative w-36 h-24 flex items-center justify-center">
        <svg
          viewBox="0 0 140 85"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="gaugeLimeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4F63D" />
              <stop offset="100%" stopColor="#A3E635" />
            </linearGradient>
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 15 75 A 58 58 0 0 1 125 75"
            fill="none"
            stroke="#252830"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Lime Progress Arc */}
          <path
            d="M 15 75 A 58 58 0 0 1 125 75"
            fill="none"
            stroke="url(#gaugeLimeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Centered Large Number */}
        <div className="absolute top-6 inset-x-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {score}%
          </span>
          <span className="text-[9px] font-semibold text-[#8E929E] uppercase">
            Score
          </span>
        </div>
      </div>
    </div>
  );
};
