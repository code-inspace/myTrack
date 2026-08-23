"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = "md",
  showText = false,
  className,
}) => {
  const sizeClasses = {
    sm: "w-7 h-7 rounded-lg",
    md: "w-9 h-9 rounded-xl",
    lg: "w-12 h-12 rounded-2xl",
    xl: "w-16 h-16 rounded-3xl",
  };

  const svgSizes = {
    sm: 16,
    md: 20,
    lg: 26,
    xl: 36,
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
  };

  const iconDim = svgSizes[size];

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Icon Badge: Dark glyph on Vibrant Lime Green */}
      <div
        className={cn(
          "bg-[#D4F63D] flex items-center justify-center flex-shrink-0 shadow-lg lime-glow-sm transition-transform hover:scale-105",
          sizeClasses[size]
        )}
      >
        <svg
          width={iconDim}
          height={iconDim}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylized geometric M & T track glyph in dark #111214 */}
          <path
            d="M4 17L8.5 7.5L12 14L15.5 7.5L20 17"
            stroke="#111214"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="6" r="2" fill="#111214" />
        </svg>
      </div>

      {showText && (
        <span className={cn("font-black tracking-tight text-white flex items-center", textClasses[size])}>
          <span>My</span>
          <span className="text-[#D4F63D]">Track</span>
        </span>
      )}
    </div>
  );
};
