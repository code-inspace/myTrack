"use client";

import React, { Suspense, useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from "date-fns";
import { Sliders, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/shared/AppHeader";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import type { Period } from "@/features/dashboard/types";
import { GoalsTab } from "@/features/bilan/components/GoalsTab";
import { AnalyseTab, DASHBOARD_CONFIG_STORAGE_KEY } from "@/features/bilan/components/AnalyseTab";
import { cn } from "@/lib/utils";

type TabId = "objectifs" | "analyse";

const TABS: { id: TabId; label: string }[] = [
  { id: "objectifs", label: "Objectifs" },
  { id: "analyse", label: "Analyse" },
];

class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: unknown) {
    console.error("Bilan page render error caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center space-y-4 bg-[#0E0F12] p-6 text-center text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#282A30] bg-[#1C1D22] text-[#D4F63D] shadow-md">
            <TrendingUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold">Bilan temporairement indisponible</h2>
          {this.state.error?.message && (
            <p className="max-w-xs break-words font-mono text-[11px] text-red-400/80">{this.state.error.message}</p>
          )}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(DASHBOARD_CONFIG_STORAGE_KEY);
              } catch {}
              this.setState({ hasError: false, error: null });
            }}
            className="cursor-pointer rounded-xl bg-[#D4F63D] px-4 py-2 text-xs font-bold text-black hover:bg-[#C2E232]"
          >
            Réinitialiser l&apos;affichage
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function BilanPage() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={null}>
        <BilanContent />
      </Suspense>
    </PageErrorBoundary>
  );
}

function BilanContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: TabId = searchParams.get("tab") === "analyse" ? "analyse" : "objectifs";

  const [period, setPeriod] = useState<Period>("week");
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const selectTab = useCallback(
    (next: TabId) => {
      router.replace(`${pathname}?tab=${next}`, { scroll: false });
    },
    [router, pathname],
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-no-swipe]") ||
      target.closest("[data-sleep-chart]") ||
      target.closest("[data-project-chart]") ||
      target.closest("button") ||
      target.closest("input") ||
      e.touches.length !== 1
    ) {
      setTouchStart(null);
      return;
    }
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || period === "all") return;
    const end = e.changedTouches[0];
    const dx = end.clientX - touchStart.x;
    const dy = end.clientY - touchStart.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const forward = dx < 0;
      setReferenceDate((prev) => {
        if (period === "day") return forward ? addDays(prev, 1) : subDays(prev, 1);
        if (period === "week") return forward ? addWeeks(prev, 1) : subWeeks(prev, 1);
        return forward ? addMonths(prev, 1) : subMonths(prev, 1);
      });
    }
    setTouchStart(null);
  };

  const customizeButton = tab === "analyse" && (
    <button
      type="button"
      onClick={() => setIsConfigOpen(true)}
      className="hidden cursor-pointer items-center gap-2 rounded-2xl border border-[#282A30] bg-[#1C1D22] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:border-[#383C48] hover:bg-[#252830] md:flex"
    >
      <Sliders className="h-4 w-4 text-[#D4F63D]" aria-hidden="true" />
      Personnaliser
    </button>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0E0F12]">
      <div className="z-30 flex-shrink-0 border-b border-[#23242A] bg-[#111214] shadow-md md:hidden">
        <AppHeader
          title="Bilan"
          rightIconAction={
            tab === "analyse"
              ? { icon: Sliders, label: "Personnaliser", onClick: () => setIsConfigOpen(true) }
              : null
          }
        />
      </div>

      <div className="z-30 flex-shrink-0 border-b border-[#23242A] bg-[#111214] shadow-md">
        <div className="mx-auto w-full max-w-md space-y-1.5 px-3 py-1.5 sm:px-4 md:max-w-6xl md:px-8 md:py-2">
          <PeriodSelector
            period={period}
            onChangePeriod={setPeriod}
            referenceDate={referenceDate}
            onChangeReferenceDate={setReferenceDate}
          />
        </div>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="mx-auto min-h-0 w-full max-w-md flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-28 pt-3 sm:px-4 md:max-w-6xl md:px-8 md:pb-10 md:pt-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="hidden select-none md:block">
            <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">Bilan</h1>
          </div>
          <div
            role="tablist"
            aria-label="Sections du bilan"
            className="grid flex-1 grid-cols-2 gap-1 rounded-2xl border border-[#282A30] bg-[#17181D] p-1 md:max-w-xs md:flex-none"
          >
            {TABS.map((t) => {
              const selected = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`bilan-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`bilan-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      selectTab(t.id === "objectifs" ? "analyse" : "objectifs");
                    }
                  }}
                  className={cn(
                    "min-h-[40px] cursor-pointer rounded-xl px-3 py-2 text-sm font-bold transition-colors",
                    selected ? "bg-[#D4F63D] text-black" : "text-[#A1A5B3] hover:text-white",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {customizeButton}
        </div>

        <div role="tabpanel" id={`bilan-panel-${tab}`} aria-labelledby={`bilan-tab-${tab}`} className="space-y-4">
          {tab === "objectifs" ? (
            <GoalsTab period={period} referenceDate={referenceDate} />
          ) : (
            <AnalyseTab
              period={period}
              referenceDate={referenceDate}
              isConfigOpen={isConfigOpen}
              onCloseConfig={() => setIsConfigOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
