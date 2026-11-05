import React from "react";
import { cn } from "@/lib/utils";

/** Shared frame of an insight: a question as the title, the answer as the content. */
export const InsightCard: React.FC<{
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ id, title, subtitle, icon, className, children }) => (
  <section
    aria-labelledby={id}
    className={cn("space-y-3 rounded-3xl border border-[#282A30] bg-[#1C1D22] p-5 shadow-sm", className)}
  >
    <div className="flex items-start gap-3">
      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-extrabold text-white">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-[#8E929E]">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

export const EmptyInsight: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="space-y-2 rounded-2xl border border-dashed border-[#343740] px-4 py-4 text-center">
    <p className="text-sm text-[#8E929E]">{children}</p>
    {action}
  </div>
);
