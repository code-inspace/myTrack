"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DataExportCard } from "@/features/profile/components/DataExportCard";
import { NotificationSettingsCard } from "@/features/notifications/components/NotificationSettingsCard";
import { CustomReminderModal } from "@/features/notifications/components/CustomReminderModal";
import { InteractiveNotificationSheet } from "@/features/notifications/components/InteractiveNotificationSheet";
import {
  getStoredPreferences,
  saveStoredPreferences,
  getStoredReminders,
  saveStoredReminders,
} from "@/features/notifications/actions";
import { useTasks } from "@/features/tasks/hooks";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { useAuth } from "@/providers/AuthProvider";
import { useDisplayMode, DisplayMode } from "@/providers/DisplayModeProvider";
import { useNightMode } from "@/features/sleep/providers/NightModeProvider";
import { getTodayDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CustomReminder } from "@/features/notifications/types";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { CalendarSubscriptionsModal } from "@/features/calendar/components/CalendarSubscriptionsModal";
import { useOffline } from "@/providers/OfflineProvider";
import { User, Flame, Trophy, Award, RotateCcw, ShieldCheck, LogOut, Sparkles, UserPlus, Bell, ChevronRight, LayoutPanelTop, PanelsTopLeft, Check, Moon, Calendar, Wifi, WifiOff, Zap } from "lucide-react";
import Link from "next/link";

const DISPLAY_MODE_OPTIONS: Array<{
  id: DisplayMode;
  label: string;
  description: string;
  icon: typeof LayoutPanelTop;
  isDefault?: boolean;
}> = [
  {
    id: "modern",
    label: "Nouveau",
    description: "Onglets Liste/Agenda/Sommeil/Bilan/Projets dans le menu du bas — dashboard et profil dans l'en-tête",
    icon: PanelsTopLeft,
    isDefault: true,
  },
  {
    id: "classic",
    label: "Classique",
    description: "Onglets en haut de l'écran — dashboard, coach IA et profil dans le menu du bas",
    icon: LayoutPanelTop,
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { displayMode, setDisplayMode } = useDisplayMode();
  const { isOnline, isLowDataMode, toggleLowDataMode } = useOffline();
  const {
    subscriptions,
    refetch,
    syncNow,
    syncSummary,
    isRefetching,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscription,
  } = useCalendarEvents();
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const {
    bedtime,
    wakeTime,
    isFeatureEnabled: isNightModeEnabled,
    isAutoLockEnabled: isNightModeAutoLockEnabled,
    toggleFeatureEnabled: toggleNightModeEnabled,
    toggleAutoLockEnabled: toggleNightModeAutoLockEnabled,
  } = useNightMode();

  const [preferences, setPreferences] = useState(getStoredPreferences());
  const [reminders, setReminders] = useState(getStoredReminders());
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [activeTestReminder, setActiveTestReminder] = useState<CustomReminder | null>(null);

  const { allTasks } = useTasks(getTodayDateString());
  const { data: stats } = useDashboardStats();

  const handleUpdatePrefs = (newPrefs: any) => {
    setPreferences(newPrefs);
    saveStoredPreferences(newPrefs);
  };

  const handleSaveReminder = (reminderData: any) => {
    const newRem: CustomReminder = {
      ...reminderData,
      id: "rem-" + Date.now(),
      userId: user?.id || "user-demo",
    };
    const updated = [...reminders, newRem];
    setReminders(updated);
    saveStoredReminders(updated);
  };

  const handleDeleteReminder = (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    saveStoredReminders(updated);
  };

  const handleResetData = () => {
    if (confirm("Réinitialiser les données de ce compte ?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-28 md:pb-10 space-y-4 max-w-md md:max-w-5xl mx-auto w-full px-4 md:px-8 pt-2 md:pt-6">
      {/* Profile Header */}
      <header className="w-full text-center md:text-left py-1 pb-3">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
          Mon Profil
        </h1>
        <p className="text-xs text-[#8E929E] mt-0.5">Paramètres du compte, affichage &amp; préférences</p>
      </header>

      {/* Desktop: two balanced columns · Mobile: single stack */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
        {/* ── Left column ── */}
        <div className="space-y-4">

      {/* User Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-extrabold text-xl shadow-md">
            {user?.name?.[0]?.toUpperCase() || "A"}
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">
              {user?.name || "Utilisateur MyTrack"}
            </h2>
            <p className="text-xs text-[#8E929E] font-mono mt-0.5">
              {user?.email || ""}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-[#282A30]">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#F87171] hover:text-red-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Badges */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-3 text-center">
          <Flame className="w-5 h-5 text-[#F97316] mx-auto mb-1" />
          <div className="text-lg font-extrabold text-white">{stats?.currentStreak ?? 0}j</div>
          <div className="text-[10px] font-semibold text-[#8E929E]">Série actuelle</div>
        </div>

        <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-3 text-center">
          <Trophy className="w-5 h-5 text-[#EAB308] mx-auto mb-1" />
          <div className="text-lg font-extrabold text-white">{stats?.bestStreak ?? 0}j</div>
          <div className="text-[10px] font-semibold text-[#8E929E]">Meilleure série</div>
        </div>

        <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-3 text-center">
          <Award className="w-5 h-5 text-[#D4F63D] mx-auto mb-1" />
          <div className="text-lg font-extrabold text-white">{stats?.totalWins ?? 0}</div>
          <div className="text-[10px] font-semibold text-[#8E929E]">Victoires</div>
        </div>
      </div>

      {/* Display Mode Selector: Nouveau (par défaut) vs Classique */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">Affichage</h3>
          <p className="text-[11px] text-[#8E929E]">Organisation des onglets et de la navigation</p>
        </div>

        <div className="space-y-2">
          {DISPLAY_MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = displayMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDisplayMode(opt.id)}
                className={cn(
                  "w-full p-3.5 rounded-2xl border flex items-start gap-3 text-left transition-all cursor-pointer",
                  isSelected
                    ? "bg-[#D4F63D]/10 border-[#D4F63D]/50"
                    : "bg-[#17181D] border-[#282A30] hover:border-[#3D4252]"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    isSelected ? "bg-[#D4F63D]/20 text-[#D4F63D]" : "bg-[#252830] text-[#8E929E]"
                  )}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs font-bold", isSelected ? "text-white" : "text-[#D1D5DB]")}>
                      {opt.label}
                    </span>
                    {opt.isDefault && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#252830] text-[#8E929E] font-mono font-bold">
                        Par défaut
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8E929E] mt-0.5 leading-snug">{opt.description}</p>
                </div>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                    isSelected ? "border-[#D4F63D] bg-[#D4F63D]" : "border-[#3D4252]"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

        </div>
        {/* ── Right column ── */}
        <div className="space-y-4">

      {/* Night Mode & Inactivity Auto-Lock Settings */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2E1A47] text-[#C084FC] flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Mode Nuit & Sommeil</h3>
              <p className="text-[11px] text-[#8E929E]">Protection du sommeil et réactivation nocturne</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#252830] text-[#C084FC] font-mono font-bold">
            {bedtime} - {wakeTime}
          </span>
        </div>

        <div className="space-y-2.5 pt-1 border-t border-[#282A30]">
          {/* Toggle 1: Enable Night Mode */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#17181D] border border-[#282A30]">
            <div className="space-y-0.5 pr-3">
              <span className="text-xs font-bold text-white block">Mode Nuit automatique</span>
              <p className="text-[10px] text-[#8E929E] leading-snug">
                Affiche l'écran noir de repos pendant vos heures de sommeil
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleNightModeEnabled(!isNightModeEnabled)}
              className={cn(
                "w-12 h-6.5 rounded-full transition-colors relative cursor-pointer flex-shrink-0",
                isNightModeEnabled ? "bg-[#D4F63D]" : "bg-[#2A2D36]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-black transition-transform absolute top-0.5",
                  isNightModeEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>

          {/* Toggle 2: Auto-Lock after 1 min inactivity */}
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-2xl bg-[#17181D] border border-[#282A30] transition-opacity",
              !isNightModeEnabled ? "opacity-40 pointer-events-none" : "opacity-100"
            )}
          >
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white block">Retour au Mode Nuit après 1 min</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#D4F63D]/20 text-[#D4F63D] font-mono font-bold">
                  Inactivité
                </span>
              </div>
              <p className="text-[10px] text-[#8E929E] leading-snug">
                Si vous déverrouillez l'app la nuit puis restez inactif 1 minute, l'écran de sommeil se réactive
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleNightModeAutoLockEnabled(!isNightModeAutoLockEnabled)}
              className={cn(
                "w-12 h-6.5 rounded-full transition-colors relative cursor-pointer flex-shrink-0",
                isNightModeAutoLockEnabled ? "bg-[#D4F63D]" : "bg-[#2A2D36]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-black transition-transform absolute top-0.5",
                  isNightModeAutoLockEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* External Calendars & Agenda Synchronization Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/15 text-[#60A5FA] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Agendas & Calendriers</h3>
              <p className="text-[11px] text-[#8E929E]">Synchronisation iCal, Google, Apple & CalDAV</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#252830] text-[#60A5FA] font-mono font-bold">
            {subscriptions.length} connecté{subscriptions.length > 1 ? "s" : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCalendarModalOpen(true)}
          className="w-full py-3 px-4 rounded-2xl bg-[#252830] hover:bg-[#2F323D] text-white hover:text-[#D4F63D] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#373A46]"
        >
          <Calendar className="w-4 h-4 text-[#D4F63D]" />
          <span>Gérer mes calendriers (Google, Apple, Pro...)</span>
        </button>
      </div>

      {/* Offline & Data Saver Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5 text-[#EF4444]" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connexion & Données</h3>
              <p className="text-[11px] text-[#8E929E]">Mode hors ligne & optimisation réseau</p>
            </div>
          </div>
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
              isOnline ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#EF4444]/15 text-[#EF4444]"
            )}
          >
            {isOnline ? "En ligne" : "Hors ligne"}
          </span>
        </div>

        <div className="space-y-2.5 pt-1 border-t border-[#282A30]">
          {/* Low Data Switch */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#17181D] border border-[#282A30]">
            <div className="space-y-0.5 pr-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white block">Mode Économie de données (Low Data)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] font-mono font-bold">
                  Réseau lent
                </span>
              </div>
              <p className="text-[10px] text-[#8E929E] leading-snug">
                Limite les requêtes d'arrière-plan et prolonge la mise en cache locale.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleLowDataMode(!isLowDataMode)}
              className={cn(
                "w-12 h-6.5 rounded-full transition-colors relative cursor-pointer flex-shrink-0",
                isLowDataMode ? "bg-[#D4F63D]" : "bg-[#2A2D36]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-black transition-transform absolute top-0.5",
                  isLowDataMode ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Management Link Banner */}
      <Link
        href="/profile/notifications"
        className="w-full p-4.5 rounded-3xl bg-[#1C1D22] border border-[#282A30] hover:border-[#D4F63D]/50 transition-all flex items-center justify-between group shadow-sm cursor-pointer"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#252830] group-hover:bg-[#D4F63D]/20 text-[#D4F63D] flex items-center justify-center transition-colors">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Gestion des Notifications</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#D4F63D]/15 text-[#D4F63D] font-mono font-bold">
                Nouveau
              </span>
            </div>
            <p className="text-xs text-[#8E929E]">Rappels d'action actuelle, bilans & mode pause</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#8E929E] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </Link>

      {/* CSV Data Export Card */}
      <DataExportCard />

      {/* Reset Data */}
      <div className="pt-2">
        <button
          onClick={handleResetData}
          className="w-full py-3 rounded-2xl bg-[#252830] hover:bg-[#343740] text-[#F87171] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Réinitialiser les données de ce compte
        </button>
      </div>

        </div>
      </div>

      {/* Calendar Subscriptions Modal */}
      <CalendarSubscriptionsModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        subscriptions={subscriptions}
        onRefresh={refetch}
        onSyncNow={syncNow}
        syncSummary={syncSummary}
        isRefetching={isRefetching}
        onAddSubscription={addSubscription}
        onUpdateSubscription={updateSubscription}
        onDeleteSubscription={deleteSubscription}
        onToggleSubscription={toggleSubscription}
      />

      {/* Custom Reminder Modal */}
      <CustomReminderModal
        isOpen={isReminderModalOpen}
        tasks={allTasks}
        onClose={() => setIsReminderModalOpen(false)}
        onSaveReminder={handleSaveReminder}
      />

      {/* Test interactive notification popup */}
      {activeTestReminder && (
        <InteractiveNotificationSheet
          isOpen={Boolean(activeTestReminder)}
          question={activeTestReminder.question}
          taskTitle={activeTestReminder.taskTitle || "Habitude"}
          onClose={() => setActiveTestReminder(null)}
          onRespond={(action, val) => {
            alert(`Action reçue: ${action} ${val ? `(${val})` : ""} - Enregistrée avec succès !`);
          }}
        />
      )}
    </div>
  );
}
