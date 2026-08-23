"use client";

import React from "react";
import { Sparkles, TrendingUp, HelpCircle, Target } from "lucide-react";

interface QuickSuggestionsProps {
  onSelectSuggestion: (text: string) => void;
}

export const QuickSuggestions: React.FC<QuickSuggestionsProps> = ({
  onSelectSuggestion,
}) => {
  const suggestions = [
    {
      label: "Comment s'est passée ma semaine ?",
      icon: TrendingUp,
    },
    {
      label: "Pourquoi mon momentum change ?",
      icon: Sparkles,
    },
    {
      label: "Quelles habitudes améliorer ?",
      icon: Target,
    },
    {
      label: "Que devrais-je faire demain ?",
      icon: HelpCircle,
    },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none py-1">
      {suggestions.map((s, idx) => {
        const Icon = s.icon;
        return (
          <button
            key={idx}
            onClick={() => onSelectSuggestion(s.label)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1D22] hover:bg-[#252830] border border-[#282A30] text-xs font-medium text-[#D1D5DB] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Icon className="w-3 h-3 text-[#D4F63D]" />
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
};
