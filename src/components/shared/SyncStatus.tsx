"use client";

import React, { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Check, CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/providers/OfflineProvider";
import { cn } from "@/lib/utils";

type Status = "offline" | "syncing" | "saved" | "idle";

/**
 * Tells the user whether their data is safe: "Synchronisation…" while requests are in flight,
 * "Enregistré" for a moment once they're done, "Hors ligne" when changes only live on the device.
 */
export const SyncStatus: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline } = useOffline();
  const mutating = useIsMutating();
  const fetching = useIsFetching();
  const [justSaved, setJustSaved] = useState(false);
  const wasBusy = useRef(false);

  const busy = mutating > 0 || fetching > 0;

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (wasBusy.current && isOnline) {
      wasBusy.current = false;
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [busy, isOnline]);

  const status: Status = !isOnline ? "offline" : busy ? "syncing" : justSaved ? "saved" : "idle";
  if (status === "idle") {
    // Keep the live region mounted (empty) so later changes are announced
    return <span role="status" aria-live="polite" className="sr-only" />;
  }

  const config = {
    offline: { icon: CloudOff, label: "Hors ligne", tone: "text-[#FCA5A5] bg-[#EF4444]/15 border-[#EF4444]/30" },
    syncing: { icon: RefreshCw, label: "Synchronisation…", tone: "text-[#D1D5DB] bg-white/5 border-white/10" },
    saved: { icon: Check, label: "Enregistré", tone: "text-[#D4F63D] bg-[#D4F63D]/10 border-[#D4F63D]/25" },
  }[status];
  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="sync-status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        config.tone,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", status === "syncing" && "motion-safe:animate-spin")} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};
