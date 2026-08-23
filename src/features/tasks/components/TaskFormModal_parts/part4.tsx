                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full h-10 px-2.5 rounded-xl bg-[#252830] border border-[#343740] text-white font-mono font-bold text-sm focus:border-[#D4F63D] outline-none text-center box-border"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 6. SECTION EXPANDABLE: Rappels & Notifications                           */}
          {/* ========================================================================= */}
          <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection("reminders")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <BellRing className="w-4 h-4 text-[#D4F63D]" />
                <span className="text-xs font-bold text-white">Rappels & Notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
                  {!enableReminders
                    ? "Désactivé"
                    : hasScheduledTime
                    ? `10 min avant (${subtractMinutesFromTime(startTime, reminderOffsetMinutes)})`
                    : `${reminderTimes.length} rappels (${reminderTimes.join(", ")})`}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                    expandedSections.reminders ? "rotate-180 text-white" : ""
                  )}
                />
              </div>
            </button>

            {expandedSections.reminders && (
              <div className="p-3.5 pt-2 border-t border-[#2B2E39] space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-medium">Activer les notifications</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableReminders}
                      onChange={(e) => setEnableReminders(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#343740] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4F63D]" />
                  </label>
                </div>

                {enableReminders && (
                  <div className="pt-2 border-t border-[#2B2E39] space-y-3">
                    {/* CASE A: Timed Task */}
                    {hasScheduledTime ? (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-[#8E929E]">
                          Moment du rappel :
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {OFFSET_OPTIONS.map((opt) => (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => setReminderOffsetMinutes(opt.value)}
                              className={cn(
                                "py-2 px-2 rounded-xl text-[11px] font-medium border text-center transition-all cursor-pointer truncate",
                                reminderOffsetMinutes === opt.value
                                  ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                                  : "bg-[#1C1D22] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-2.5 p-2 rounded-xl bg-[#17181D] border border-[#2B2E38] flex items-center justify-between text-xs">
                          <span className="text-[#8E929E]">Notification prévue à :</span>
                          <span className="font-mono font-bold text-[#D4F63D]">
                            ⏰ {subtractMinutesFromTime(startTime, reminderOffsetMinutes)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* CASE B: All-day Task */
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#8E929E]">
                            Heures des rappels ({reminderTimes.length}) :
                          </span>
                          <button
                            type="button"
                            onClick={handleAddAllDayReminder}
                            className="text-[11px] font-bold text-[#D4F63D] hover:underline flex items-center gap-1 cursor-pointer bg-[#1C1D22] px-2.5 py-1 rounded-lg border border-[#343740]"
                          >
                            <Plus className="w-3 h-3" />
                            Ajouter un rappel
                          </button>
                        </div>

                        <div className="space-y-2">
                          {reminderTimes.map((rTime, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-xl bg-[#1C1D22] border border-[#2B2E38]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[#8E929E] font-medium">
                                  Rappel {idx + 1} :
                                </span>
                                <input
                                  type="time"
                                  value={rTime}
                                  onChange={(e) => handleUpdateAllDayReminderTime(idx, e.target.value)}
                                  className="h-8 px-2 rounded-lg bg-[#252830] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center box-border"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveAllDayReminder(idx)}
                                disabled={reminderTimes.length <= 1}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  reminderTimes.length > 1
                                    ? "text-[#8E929E] hover:text-red-400 hover:bg-[#252830] cursor-pointer"
                                    : "text-[#4B5563] cursor-not-allowed opacity-40"
                                )}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-[#D4F63D] hover:bg-[#c2e432] active:scale-[0.98] text-[#111214] font-bold text-base shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-5"
          >
            {isEditing ? (
              <>
                <Check className="w-5 h-5 stroke-[3]" />
                Enregistrer les modifications
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 stroke-[3]" />
                Créer la tâche
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
