"use client";

import React from "react";
import { Period } from "@/features/dashboard/types";
import { format } from "date-fns";
import { AppleHealthSleepView } from "@/features/sleep/components/AppleHealthSleepView";

interface SleepWaveChartProps {
  period: Period;
  referenceDate: Date;
}

export const SleepWaveChart: React.FC<SleepWaveChartProps> = ({
  referenceDate,
}) => {
  const dateStr = format(referenceDate, "yyyy-MM-dd");

  return (
    <div className="w-full bg-[#0E0F12] rounded-3xl p-3 sm:p-5 border border-[#23242A]">
      <AppleHealthSleepView selectedDate={dateStr} />
    </div>
  );
};
