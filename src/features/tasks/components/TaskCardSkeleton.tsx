"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TaskCardSkeletonProps {
  count?: number;
  className?: string;
}

export const TaskCardSkeleton: React.FC<TaskCardSkeletonProps> = ({
  count = 3,
  className,
}) => {
  return (
    <div className={cn("space-y-3 w-full", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="relative overflow-hidden rounded-2xl bg-[#17181F]/80 border border-[#282B36]/60 p-4 shadow-sm"
        >
          {/* Shimmer sweep effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Checkbox circle skeleton */}
              <div className="w-6 h-6 rounded-full bg-[#252833] animate-pulse flex-shrink-0" />

              {/* Title & tags */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-4 bg-[#282B38] rounded-md w-3/5 animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-3 bg-[#20222B] rounded-md w-16 animate-pulse" />
                  <div className="h-3 bg-[#20222B] rounded-md w-12 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Right action buttons skeleton */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-[#252833] animate-pulse" />
              <div className="w-8 h-8 rounded-xl bg-[#252833] animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
