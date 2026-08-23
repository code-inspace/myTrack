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
import { getTodayDateString } from "@/lib/dates";
import { CustomReminder } from "@/features/notifications/types";
import { User, Flame, Trophy, Award, RotateCcw, ShieldCheck, LogOut, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, switchToDemo } = useAuth();

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

  const isDemoAccount = user?.isDemo || user?.email === "demo@de.mo";

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-28 space-y-4 max-w-md mx-auto w-full px-4 pt-2">
      {/* Profile Header */}
      <header className="w-full text-center py-2">
        <h1 className="text-xl font-extrabold text-white tracking-tight">
          Profil
        </h1>
      </header>

      {/* User Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-extrabold text-xl shadow-md">
              {user?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {user?.name || "Utilisateur MyTrack"}
              </h2>
              <p className="text-xs text-[#8E929E] font-mono mt-0.5">
                {user?.email || "demo@de.mo"}
              </p>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              isDemoAccount
                ? "bg-[#D4F63D]/15 text-[#D4F63D] border border-[#D4F63D]/30"
                : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>{isDemoAccount ? "Compte Démo" : "Compte Actif"}</span>
          </div>
        </div>

        {/* Account Switcher Bar */}
        <div className="pt-2 border-t border-[#282A30] flex items-center justify-between gap-2 text-xs">
          {isDemoAccount ? (
            <Link
              href="/auth/signup"
              className="text-[#8E929E] hover:text-[#D4F63D] font-semibold transition-colors flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Créer un compte vierge</span>
            </Link>
          ) : (
            <button
              onClick={() => switchToDemo()}
              className="text-[#8E929E] hover:text-[#D4F63D] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Basculer sur le compte Démo (demo@de.mo)</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-[#F87171] hover:text-red-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
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

      {/* Notifications Section */}
      <NotificationSettingsCard
        preferences={preferences}
        reminders={reminders}
        onUpdatePreferences={handleUpdatePrefs}
        onOpenNewReminder={() => setIsReminderModalOpen(true)}
        onDeleteReminder={handleDeleteReminder}
        onTestNotification={(rem) => setActiveTestReminder(rem)}
      />

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
