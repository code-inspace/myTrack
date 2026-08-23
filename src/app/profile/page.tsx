"use client";

import React, { useState } from "react";
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
import { getTodayDateString } from "@/lib/dates";
import { CustomReminder } from "@/features/notifications/types";
import { User, Flame, Trophy, Award, RotateCcw, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
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
      userId: "user-demo",
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
    if (confirm("Reset local demo data to default settings?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12 space-y-4">
      {/* Profile Header */}
      <header className="w-full text-center py-2">
        <h1 className="text-xl font-extrabold text-white tracking-tight">
          Profile
        </h1>
      </header>

      {/* User Card */}
      <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-extrabold text-xl shadow-md">
          A
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Axel</h2>
          <p className="text-xs text-[#8E929E]">axel@mytrack.app</p>
          <div className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-[#D4F63D] bg-[#D4F63D]/10 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            MyTrack Pro Active
          </div>
        </div>
      </div>

      {/* Stats Summary Badges */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-3 text-center">
          <Flame className="w-5 h-5 text-[#F97316] mx-auto mb-1" />
          <div className="text-lg font-extrabold text-white">{stats?.currentStreak ?? 4}d</div>
          <div className="text-[10px] font-semibold text-[#8E929E]">Current Streak</div>
        </div>

        <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-3 text-center">
          <Trophy className="w-5 h-5 text-[#EAB308] mx-auto mb-1" />
          <div className="text-lg font-extrabold text-white">{stats?.bestStreak ?? 7}d</div>
          <div className="text-[10px] font-semibold text-[#8E929E]">Best Streak</div>
        </div>

        <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-3 text-center">
          <Award className="w-5 h-5 text-[#D4F63D] mx-auto mb-1" />
          <div className="text-lg font-extrabold text-white">{stats?.totalWins ?? 15}</div>
          <div className="text-[10px] font-semibold text-[#8E929E]">Total Wins</div>
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

      {/* Reset / Sign Out */}
      <div className="pt-2">
        <button
          onClick={handleResetData}
          className="w-full py-3 rounded-2xl bg-[#252830] hover:bg-[#343740] text-[#F87171] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Demo Data to Defaults
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
          taskTitle={activeTestReminder.taskTitle || "Habit"}
          onClose={() => setActiveTestReminder(null)}
          onRespond={(action, val) => {
            alert(`Action reçue: ${action} ${val ? `(${val})` : ""} - Enregistrée avec succès !`);
          }}
        />
      )}
    </div>
  );
}
