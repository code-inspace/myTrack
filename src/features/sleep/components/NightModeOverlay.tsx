"use client";

import React, { useState, useEffect, useRef } from "react";
import { Moon, Sun, Lock, Check, Clock, Sparkles, BedDouble, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface NightModeOverlayProps {
  bedtime: string; // e.g. "22:30"
  wakeTime: string; // e.g. "07:15"
  isSleeping: boolean;
  sleepingStartedAt: string | null;
  onSleepNow: () => void;
  onWakeUp: () => void;
  onUnlockTasks: () => void;
  onCloseTest?: () => void;
  isTestMode?: boolean;
}

export const NightModeOverlay: React.FC<NightModeOverlayProps> = ({
  bedtime,
  wakeTime,
  isSleeping,
  sleepingStartedAt,
  onSleepNow,
  onWakeUp,
  onUnlockTasks,
  onCloseTest,
  isTestMode = false,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [sleepDurationText, setSleepDurationText] = useState<string>("00:00");
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [isUnlockedSuccess, setIsUnlockedSuccess] = useState<boolean>(false);

  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTimeRef = useRef<number>(0);
  const HOLD_DURATION_MS = 5000; // 5 seconds

  // Update live clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(format(now, "HH:mm"));

      if (isSleeping && sleepingStartedAt) {
        const start = new Date(sleepingStartedAt);
        const diffMs = Math.max(0, now.getTime() - start.getTime());
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const seconds = Math.floor((diffMs % 60000) / 1000);
        setSleepDurationText(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isSleeping, sleepingStartedAt]);

  // Handle 5-second long press
  const startHolding = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isUnlockedSuccess) return;

    setIsHolding(true);
    holdStartTimeRef.current = Date.now();
    setHoldProgress(0);

    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (elapsed >= HOLD_DURATION_MS) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        setIsUnlockedSuccess(true);
        setIsHolding(false);
        // Trigger unlock after subtle success animation
        setTimeout(() => {
          onUnlockTasks();
        }, 400);
      }
    }, 40);
  };

  const cancelHolding = () => {
    if (isUnlockedSuccess) return;
    setIsHolding(false);
    setHoldProgress(0);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const remainingSeconds = Math.max(1, Math.ceil(((100 - holdProgress) / 100) * 5));

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden flex flex-col items-center justify-between px-6 py-8 select-none touch-none bg-[#0B0C15]">
      {/* 1. Deep Space Night Gradient & Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 10%, #221652 0%, #110E29 45%, #080912 100%)",
          }}
        />
        {/* Soft floating glow aura */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-[#7C3AED]/15 blur-[90px] animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full bg-[#4F46E5]/20 blur-[60px]" />
      </div>

      {/* 2. Twinkling Stars Canvas Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-80">
        {[
          { top: "8%", left: "15%", size: 3, delay: "0s" },
          { top: "14%", left: "82%", size: 2, delay: "1.2s" },
          { top: "22%", left: "30%", size: 2.5, delay: "0.5s" },
          { top: "28%", left: "70%", size: 3.5, delay: "2.1s" },
          { top: "40%", left: "12%", size: 2, delay: "1.7s" },
          { top: "45%", left: "88%", size: 3, delay: "0.8s" },
          { top: "58%", left: "20%", size: 2.5, delay: "2.5s" },
          { top: "62%", left: "78%", size: 2, delay: "1.1s" },
          { top: "75%", left: "35%", size: 3, delay: "0.3s" },
          { top: "82%", left: "85%", size: 2.5, delay: "1.9s" },
          { top: "18%", left: "50%", size: 1.5, delay: "0.7s" },
          { top: "35%", left: "92%", size: 2, delay: "2.8s" },
        ].map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: star.delay,
              animationDuration: "3s",
              boxShadow: "0 0 8px rgba(255,255,255,0.8)",
            }}
          />
        ))}
      </div>

      {/* 3. Header Section: Title & Alarm / Bedtime indicator */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center pt-3 animate-fade-in">
        {isTestMode && onCloseTest && (
          <button
            type="button"
            onClick={onCloseTest}
            className="self-end mb-2 px-3 py-1 text-[11px] rounded-full bg-[#1F202B] text-[#A5A8B6] hover:text-white border border-[#2F3140] transition-colors"
          >
            Fermer l&apos;aperçu
          </button>
        )}

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.25)]">
          {isSleeping ? "Bonne nuit" : "Il est temps de dormir"}
        </h1>

        <div className="mt-2.5 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18162E]/80 border border-[#302B5C] text-[#C4B8F5] text-xs font-medium backdrop-blur-md shadow-inner">
          <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span>
            {isSleeping ? `Réveil prévu : ${wakeTime}` : `Heure de coucher : ${bedtime} • Réveil : ${wakeTime}`}
          </span>
        </div>
      </div>

      {/* 4. Center Celestial Moon & Cloud Animation */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          {/* Orbital Concentric Arc Rings */}
          <div className="absolute inset-2 rounded-full border border-[#8B5CF6]/20 animate-[spin_40s_linear_infinite]" />
          <div className="absolute inset-8 rounded-full border border-[#A78BFA]/15 border-dashed animate-[spin_30s_linear_infinite_reverse]" />
          <div className="absolute inset-14 rounded-full border border-[#C4B8F5]/10" />

          {/* Crescent Moon Graphic with Glowing Aura */}
          <div className="relative flex items-center justify-center drop-shadow-[0_0_35px_rgba(196,184,245,0.35)]">
            <svg
              className="w-48 h-48 sm:w-56 sm:h-56 text-[#F3F0FF] transition-transform duration-1000 ease-out"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="60%" stopColor="#E9D5FF" />
                  <stop offset="100%" stopColor="#C084FC" />
                </linearGradient>
                <filter id="moonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M 50 10 C 65 10 78 18 84 30 C 60 30 42 50 42 74 C 42 80 44 86 47 90 C 26 86 10 68 10 47 C 10 26 28 10 50 10 Z"
                fill="url(#moonGrad)"
                filter="url(#moonGlow)"
              />
            </svg>

            {/* Live Clock Embedded in the Arc */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pl-6">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                {currentTime || bedtime}
              </span>
              <span className="text-[11px] font-semibold text-[#A78BFA] tracking-wider uppercase mt-0.5">
                {isSleeping ? "En sommeil" : "Mode Nuit"}
              </span>
            </div>
          </div>

          {/* Floating Soft Clouds */}
          <div className="absolute -bottom-2 -left-2 w-32 h-14 bg-gradient-to-r from-[#241D4C]/90 to-[#372A6E]/90 rounded-full blur-[1px] border border-[#523E99]/40 flex items-center justify-center shadow-lg animate-[bounce_6s_ease-in-out_infinite]">
            <div className="w-10 h-10 -mt-6 bg-[#372A6E] rounded-full" />
          </div>
          <div className="absolute -bottom-4 right-2 w-40 h-16 bg-gradient-to-r from-[#2E245E]/90 to-[#433284]/90 rounded-full blur-[1px] border border-[#5E47AE]/40 shadow-xl animate-[bounce_8s_ease-in-out_infinite_reverse]">
            <div className="w-12 h-12 -mt-7 ml-4 bg-[#433284] rounded-full" />
          </div>
          <div className="absolute top-12 right-2 w-24 h-10 bg-[#282052]/60 rounded-full blur-[1px] border border-[#483786]/20 animate-[pulse_5s_ease-in-out_infinite]" />
        </div>

        {/* Sleep Duration Tracker Info when in sleeping state */}
        {isSleeping && (
          <div className="mt-4 flex flex-col items-center animate-fade-in">
            <span className="text-xs font-medium text-[#C4B8F5]/80">Durée du sommeil</span>
            <div className="mt-1 px-4 py-1.5 rounded-full bg-[#1C1738] border border-[#3E326E] text-white font-mono text-sm font-bold shadow-inner">
              {sleepDurationText}
            </div>
          </div>
        )}
      </div>

      {/* 5. Actions Section: 3 Buttons */}
      <div className="relative z-20 w-full max-w-sm space-y-3 pb-2">
        {/* Button 1: "Je me couche maintenant" */}
        <button
          type="button"
          onClick={onSleepNow}
          className={cn(
            "w-full py-3.5 px-5 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-[0.98]",
            isSleeping
              ? "bg-[#1E193C] border border-[#4C3B8A] text-[#C4B8F5] hover:bg-[#27214E]"
              : "bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#6D28D9] text-white border border-[#A78BFA]/50 shadow-[0_0_25px_rgba(124,58,237,0.45)] hover:brightness-110"
          )}
        >
          <Moon className="w-5 h-5 fill-current" />
          <span>{isSleeping ? "Je suis couché • Enregistrer l'heure" : "Je me couche maintenant"}</span>
        </button>

        {/* Button 2: "Je me réveille" */}
        <button
          type="button"
          onClick={onWakeUp}
          className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm sm:text-base bg-[#181924] hover:bg-[#232433] text-white border border-[#2F3246] flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md active:scale-[0.98]"
        >
          <Sun className="w-5 h-5 text-[#FBBF24]" />
          <span>Je me réveille</span>
        </button>

        {/* Button 3: "Je veux voir mes tâches" with 5-second Hold */}
        <div className="pt-1">
          <button
            type="button"
            onMouseDown={startHolding}
            onMouseUp={cancelHolding}
            onMouseLeave={cancelHolding}
            onTouchStart={startHolding}
            onTouchEnd={cancelHolding}
            onTouchCancel={cancelHolding}
            className={cn(
              "relative w-full py-3.5 px-5 rounded-2xl font-medium text-xs sm:text-sm overflow-hidden flex items-center justify-center gap-2 border transition-all cursor-pointer select-none",
              isUnlockedSuccess
                ? "bg-[#162B1A] border-[#4ADE80] text-[#4ADE80]"
                : isHolding
                ? "bg-[#1C1833] border-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] scale-[0.99]"
                : "bg-[#11121B]/80 hover:bg-[#1A1B28] border-[#252738] text-[#8E92A8] hover:text-[#C5C8DB]"
            )}
          >
            {/* Animated filling background progress bar */}
            {isHolding && (
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#6D28D9]/40 to-[#A855F7]/50 transition-all duration-75 ease-linear pointer-events-none"
                style={{ width: `${holdProgress}%` }}
              />
            )}

            {isUnlockedSuccess ? (
              <>
                <Check className="w-4 h-4 text-[#4ADE80] relative z-10" />
                <span className="relative z-10 font-bold">Déverrouillage réussi !</span>
              </>
            ) : isHolding ? (
              <>
                <div className="w-4 h-4 relative z-10 flex items-center justify-center font-bold text-xs text-[#D4F63D]">
                  {remainingSeconds}
                </div>
                <span className="relative z-10 font-bold text-white">
                  Maintenez encore {remainingSeconds}s...
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-[#6B7088] relative z-10" />
                <span className="relative z-10">Je veux voir mes tâches</span>
                <span className="relative z-10 text-[10px] text-[#6B7088] font-normal">
                  (Maintenir 5s)
                </span>
              </>
            )}
          </button>

          {isHolding && (
            <p className="text-[10px] text-[#A5A8B6] text-center mt-1.5 animate-pulse">
              Ne relâchez pas le bouton pour quitter le mode nuit
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
