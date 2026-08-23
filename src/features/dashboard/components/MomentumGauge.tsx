"use client";

import React from "react";
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
  // Arc from 180 deg to 360 deg
  const radius = 58;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // Half-circle length
  const progressClamped = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (circumference * progressClamped) / 100;

  return (
    <div className="flex items-center justify-between w-full pt-1 pb-2">
      {/* Left Text */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Momentum
        </h2>
        <div className="text-xs font-semibold text-[#D4F63D] mt-1 flex items-center gap-1">
          <span>{delta >= 0 ? `+${delta}` : delta} vs semaine dernière !</span>
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
              <stop offset="100%" stopColor="#c6f135" />
            </linearGradient>
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
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
        <div className="absolute top-7 inset-x-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {score}
          </span>
        </div>
      </div>
    </div>
  );
};
