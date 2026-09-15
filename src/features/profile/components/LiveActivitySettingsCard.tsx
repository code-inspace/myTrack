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
  const [isStandbyEnabled, setIsStandbyEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mytrack_lockscreen_standby") !== "false";
    }
    return true;
  });

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

  const handleToggleStandby = async (newVal: boolean) => {
    setIsStandbyEnabled(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("mytrack_lockscreen_standby", newVal ? "true" : "false");
    }
    await LiveActivityBridge.syncStandby(null, newVal);
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

  const handleTestStandby = async () => {
    await LiveActivityBridge.syncStandby(
      {
        id: "demo-next-task",
        title: "Lecture & Routine du soir",
        category: "Personnel",
      },
      true
    );
  };

  return (
    <div className="rounded-3xl bg-[#17181F] border border-[#282B36] p-5 space-y-5 shadow-sm">
      {/* Header with Title and Live Status Badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#D4F63D]/15 border border-[#D4F63D]/30 flex items-center justify-center text-[#D4F63D]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Activités en direct &amp; Écran Verrouillé</span>
            </h3>
            <p className="text-xs text-[#8E929E]">
              Chronomètre en direct, Dynamic Island &amp; widgets de verrouillage
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

      {/* Standby Lock Screen Toggle Option */}
      <div className="bg-[#121317] border border-[#23252E] rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              Widget permanent en veille (Écran verrouillé)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#D4F63D]/15 border border-[#D4F63D]/30 text-[#D4F63D] font-extrabold text-[10px]">
              NOUVEAU
            </span>
          </div>
          <p className="text-xs text-[#8E929E] leading-relaxed">
            Quand aucune tâche n&apos;est active, affiche une bannière sur l&apos;écran verrouillé avec un champ rapide pour créer une tâche et un bouton pour lancer la prochaine tâche.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isStandbyEnabled}
          onClick={() => handleToggleStandby(!isStandbyEnabled)}
          className={cn(
            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            isStandbyEnabled ? "bg-[#D4F63D]" : "bg-[#282B36]"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#111214] shadow-md ring-0 transition duration-200 ease-in-out",
              isStandbyEnabled ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {/* Step by step Instructions Card */}
      <div className="bg-[#121317] border border-[#23252E] rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#D4F63D]" />
          <span>Configuration &amp; Astuces Écran Verrouillé</span>
        </h4>

        <div className="space-y-2.5 text-xs text-[#C5C8D4] leading-relaxed">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#20222B] text-[#D4F63D] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </span>
            <div>
              <strong className="text-white font-semibold">Bannière en veille (Live Activity) :</strong>
              <p className="text-[#8E929E] mt-0.5">
                Reste affichée sur l&apos;écran verrouillé dès qu&apos;aucune tâche n&apos;est en cours avec le raccourci vers la saisie rapide et la prochaine tâche.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#20222B] text-[#D4F63D] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </span>
            <div>
              <strong className="text-white font-semibold">Widget sous l&apos;horloge (Accessory Widget) :</strong>
              <p className="text-[#8E929E] mt-0.5">
                Sur votre écran verrouillé, faites un <span className="text-[#D4F63D]">appui long &gt; Personnaliser</span>, touchez la zone sous l&apos;horloge et ajoutez le widget <span className="text-white font-medium">myTrack</span>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#20222B] text-[#D4F63D] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </span>
            <div>
              <strong className="text-white font-semibold">Autorisations iOS requises :</strong>
              <p className="text-[#8E929E] mt-0.5">
                Dans <span className="text-[#D4F63D]">Réglages &gt; Face ID et code</span>, vérifiez que <em>« Activités en direct »</em> est activé en mode verrouillé.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Open iOS Settings, Test Live Activity & Preview Standby */}
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
          onClick={handleTestStandby}
          className="px-4 py-3 rounded-2xl bg-[#20222B] hover:bg-[#282A36] border border-[#323644] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#D4F63D]" />
          <span>Tester la veille Lock Screen</span>
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
              <span>Test en cours ({testCountdown}s)</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-[#D4F63D]" />
              <span>Tester chrono</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
