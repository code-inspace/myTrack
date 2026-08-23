
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={prefs.eveningRecapTime || "21:00"}
                  onChange={(e) => handleUpdatePrefs({ ...prefs, eveningRecapTime: e.target.value })}
                  className="h-7 px-2 rounded-lg bg-[#22242B] border border-[#343740] text-white text-xs font-mono font-bold outline-none text-center"
                />
                <button
                  onClick={() => handleTogglePref("eveningRecap")}
                  className={cn(
                    "w-9 h-5 rounded-full transition-colors relative cursor-pointer",
                    prefs.eveningRecap ? "bg-[#D4F63D]" : "bg-[#282A30]"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full bg-black transition-transform transform",
                      prefs.eveningRecap ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Streak */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#141518] border border-[#2B2E38]">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
                <div>
                  <div className="text-xs font-bold text-white">Alerte protection de streak</div>
                  <div className="text-[10px] text-[#8E929E]">Sauvegarde de série en danger</div>
                </div>
              </div>

              <button
                onClick={() => handleTogglePref("streakReminder")}
                className={cn(
                  "w-9 h-5 rounded-full transition-colors relative cursor-pointer",
                  prefs.streakReminder ? "bg-[#D4F63D]" : "bg-[#282A30]"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full bg-black transition-transform transform",
                    prefs.streakReminder ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. RAPPELS INTERACTIFS & QUESTIONS PERSONNALISÉES                         */}
        {/* ========================================================================= */}
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white">Rappels interactifs</h3>
              <p className="text-[11px] text-[#8E929E]">Questions avec validation directe</p>
            </div>

            <button
              onClick={() => setIsReminderModalOpen(true)}
              className="p-2 rounded-xl bg-[#252830] hover:bg-[#343740] text-[#D4F63D] transition-all cursor-pointer"
              title="Ajouter un rappel interactif"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {reminders.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-[#141518] border border-[#2B2E38] text-[11px] text-[#8E929E]">
                Aucun rappel personnalisé créé pour le moment.
              </div>
            ) : (
              reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-3 rounded-2xl bg-[#141518] border border-[#2B2E38] flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{rem.question}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[#8E929E] mt-1">
                      <Clock className="w-3 h-3 text-[#D4F63D]" />
                      <span>{rem.time}</span>
                      <span>•</span>
                      <span>{rem.taskTitle || "Habitude"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setTestNotification({
                          isOpen: true,
                          question: rem.question,
                          taskTitle: rem.taskTitle || "Habitude",
                        })
                      }
                      className="p-1.5 text-[#8E929E] hover:text-[#D4F63D] transition-colors rounded-lg bg-[#22242B]"
                      title="Tester l'affichage"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="p-1.5 text-[#8E929E] hover:text-[#EF4444] transition-colors rounded-lg bg-[#22242B]"
                      title="Supprimer ce rappel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal for creating interactive reminders */}
      <CustomReminderModal
        isOpen={isReminderModalOpen}
        tasks={[]}
        onClose={() => setIsReminderModalOpen(false)}
        onSaveReminder={handleSaveCustomReminder}
      />

      {/* Actionable sheet test */}
      {testNotification.isOpen && (
        <InteractiveNotificationSheet
          isOpen={testNotification.isOpen}
          question={testNotification.question}
          taskTitle={testNotification.taskTitle}
          onClose={() => setTestNotification({ isOpen: false, question: "", taskTitle: "" })}
          onRespond={() => {
            setTestNotification({ isOpen: false, question: "", taskTitle: "" });
          }}
        />
      )}
    </div>
  );
}
