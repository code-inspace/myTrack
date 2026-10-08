import React from "react";
import { cn } from "@/lib/utils";
import { getPriorityLabel, getPriorityMarks } from "../priority";

/**
 * Color-free priority marker, readable on any project color: "!" outlined in the surrounding text
 * color (urgente), "!!" as a solid white pill (très urgente). Renders nothing for normal tasks.
 */
export const PriorityBadge: React.FC<{
  priority?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}> = ({ priority, size = "sm", className }) => {
  const marks = getPriorityMarks(priority);
  if (!marks) return null;
  const label = getPriorityLabel(priority);
  return (
    <span
      role="img"
      aria-label={`Priorité ${label.toLowerCase()}`}
      title={`Priorité ${label.toLowerCase()}`}
      data-testid={`priority-badge-${priority}`}
      className={cn(
        "inline-flex items-center justify-center flex-shrink-0 rounded-md font-black leading-none tracking-tighter border border-current/60",
        size === "xs" && "h-3 min-w-[12px] px-0.5 text-[8px]",
        size === "sm" && "h-4 min-w-[16px] px-1 text-[10px]",
        size === "md" && "h-5 min-w-[20px] px-1 text-xs",
        priority === "VERY_URGENT" && "bg-white text-[#111214] border-white",
        className,
      )}
    >
      {marks}
    </span>
  );
};
