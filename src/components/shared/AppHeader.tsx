"use client";

import React from "react";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = "Mes Tâches",
  subtitle,
}) => {
  return (
    <header className="w-full flex items-center justify-center py-3 px-1">
      <div className="text-center">
        <h1 className="text-lg font-extrabold text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] font-medium text-[#8E929E] -mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
};
