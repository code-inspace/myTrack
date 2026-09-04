"use client";

import React, { useState, useEffect } from "react";
import { LiveActivityBridge } from "@/lib/native/liveActivity";
import { Smartphone, CheckCircle2, AlertTriangle, ExternalLink, Sparkles, ShieldCheck, Play, Square, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const LiveActivitySettingsCard: React.FC = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [authStatus, setAuthStatus] = useState<{
    enabled: boolean;
    frequentUpdatesEnabled: boolean;
    supported: boolean;
    reason?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testCountdown, setTestCountdown] = useState(0);

  const checkStatus = async () => {
    setIsLoading(true);
    const supported = LiveActivityBridge.isSupported();
    setIsSupported(supported);
    if (supported) {
      const res = await LiveActivityBridge.checkAuthorization();
      setAuthStatus(res);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkStatus();

    // Re-check when window is focused (e.g. returning from iOS Settings)
    const handleFocus = () => {
      checkStatus();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleOpenSettings = async () => {
    await LiveActivityBridge.openSettings();
  };

  const handleStartTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestCountdown(15);

    const testTaskId = "test-dynamic-island-" + Date.now();
    await LiveActivityBridge.startActivity(
      {
        taskId: testTaskId,
        taskTitle: "Test Dynamic Island ⚡️",
        category: "Démonstration myTrack",
      },
      {
        currentStatus: "IN_PROGRESS",
        startedAtTimestamp: Date.now(),
        elapsedSeconds: 0,
        targetDurationSeconds: 15,
        totalFormattedDuration: "15 sec",
        subtitle: "Verrouillez ou quittez l'app !",
        progress: 0.2,
      }
    );

    const interval = setInterval(() => {
      setTestCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          LiveActivityBridge.stopActivity(testTaskId);
          setIsTesting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="rounded-3xl bg-[#17181F] border border-[#282B36] p-5 space-y-4 shadow-sm">
      {/* Header with Title and Live Status Badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#D4F63D]/15 border border-[#D4F63D]/30 flex items-center justify-center text-[#D4F63D]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Activités en direct &amp; Dynamic Island</span>
            </h3>
            <p className="text-xs text-[#8E929E]">
              Chronomètre en temps réel sur l&apos;écran verrouillé &amp; la Dynamic Island
            </p>
          </div>
        </div>

        {/* Status Pill */}
        {authStatus?.enabled ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Activé</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>À autoriser</span>
          </span>
        )}
      </div>

      {/* Step by step Instructions Card */}
      <div className="bg-[#121317] border border-[#23252E] rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#D4F63D]" />
          <span>Configuration requise sur votre iPhone</span>
        </h4>

        <div className="space-y-2 text-xs text-[#C5C8D4] leading-relaxed">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#20222B] text-[#D4F63D] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </span>
            <div>
              <strong className="text-white font-semibold">Autoriser les Activités en direct :</strong>
              <p className="text-[#8E929E] mt-0.5">
                Allez dans <span className="text-[#D4F63D]">Réglages</span> &gt; descendez jusqu&apos;à <span className="text-white">myTrack</span> &gt; touchez <span className="text-white">Activités en direct</span> et activez le bouton.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#20222B] text-[#D4F63D] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </span>
            <div>
              <strong className="text-white font-semibold">Autoriser sur l&apos;écran verrouillé :</strong>
              <p className="text-[#8E929E] mt-0.5">
                Allez dans <span className="text-[#D4F63D]">Réglages</span> &gt; <span className="text-white">Face ID et code</span> &gt; descendez à <em>« Autoriser l&apos;accès en mode verrouillé »</em> &gt; activez <span className="text-white">Activités en direct</span>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#20222B] text-[#D4F63D] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </span>
            <div>
              <strong className="text-white font-semibold">Compatibilité :</strong>
              <p className="text-[#8E929E] mt-0.5">
                La pilule animée <span className="text-white font-medium">Dynamic Island</span> s&apos;affiche sur iPhone 14 Pro, 15 et 16. Sur les autres modèles (11, 12, 13, 14), le widget s&apos;affiche sur l&apos;écran de verrouillage.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Open iOS Settings & Test Live Activity */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex-1 px-4 py-3 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e42f] active:scale-98 text-black font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Ouvrir les Réglages iOS</span>
        </button>

        <button
          type="button"
          onClick={handleStartTest}
          disabled={isTesting}
          className={cn(
            "px-4 py-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
            isTesting
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
              : "bg-[#20222B] hover:bg-[#282A36] border-[#323644] text-white"
          )}
        >
          {isTesting ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span>Test en cours ({testCountdown}s) — Quittez l&apos;app !</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-[#D4F63D]" />
              <span>Tester la Dynamic Island</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
