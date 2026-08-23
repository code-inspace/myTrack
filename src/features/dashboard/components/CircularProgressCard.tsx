"use client";

import React from "react";

interface CircularMetricProps {
  title: string;
  valueText: string;
  subText?: string;
  percentage: number; // 0 to 100
}

export const CircularMetricCard: React.FC<CircularMetricProps> = ({
  title,
  valueText,
  subText,
  percentage,
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.max(0, Math.min(100, percentage))) / 100;

  return (
    <div className="flex-1 bg-[#1C1D22] border border-[#282A30] rounded-3xl p-4 flex flex-col items-center justify-between text-center min-h-[160px]">
      <h3 className="text-xs font-semibold text-[#8E929E] tracking-tight">
        {title}
      </h3>

      <div className="relative w-24 h-24 my-2 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Background circle track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#252830"
            strokeWidth="8"
          />

          {/* Progress circle arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#D4F63D"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold text-white leading-none">
            {valueText}
          </span>
          {subText && (
            <span className="text-[10px] font-medium text-[#8E929E] mt-0.5">
              {subText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
