                {prefs.allDisabled ? "Toutes les notifications sont en pause" : "Mettre en pause toutes les notifications"}
              </h3>
              <p className="text-[11px] text-[#8E929E] mt-0.5">
                {prefs.allDisabled
                  ? "Désactive ce bouton pour restaurer exactement tes réglages."
                  : "Coupe temporairement tous les rappels."}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleMasterMute}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0",
              prefs.allDisabled ? "bg-[#EF4444]" : "bg-[#282A30]"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full bg-white transition-transform transform",
                prefs.allDisabled ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {/* Global Web Push Permission Activator */}
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-4 shadow-sm">
          <NotificationPermissionButton />
        </div>

        {/* ========================================================================= */}
        {/* 2. CHECK-IN PÉRIODIQUE : Que fais-tu actuellement ? (NOUVELLE FEATURE)    */}
        {/* ========================================================================= */}
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#D4F63D]/10 border border-[#D4F63D]/20 flex items-center justify-center text-[#D4F63D]">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Rappel d'action actuelle</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#D4F63D]/20 text-[#D4F63D] font-mono font-bold">
                    PRO
                  </span>
                </h3>
                <p className="text-[11px] text-[#8E929E]">Notification périodique : « Que fais-tu actuellement ? »</p>
              </div>
            </div>

            <button
              onClick={() => handleTogglePref("currentActionCheckinEnabled")}
              className={cn(
                "w-10 h-5 rounded-full transition-colors relative cursor-pointer",
                prefs.currentActionCheckinEnabled ? "bg-[#D4F63D]" : "bg-[#282A30]"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-black transition-transform transform",
                  prefs.currentActionCheckinEnabled ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {prefs.currentActionCheckinEnabled && (
            <div className="pt-3 border-t border-[#282A30] space-y-3.5 animate-in fade-in duration-200">
              {/* Frequency selection */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E929E]">
                  Fréquence du rappel :
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleUpdatePrefs({ ...prefs, currentActionIntervalMinutes: opt.value })}
                      className={cn(
                        "py-2 px-1 rounded-xl text-[11px] font-semibold border text-center transition-all cursor-pointer truncate",
                        (prefs.currentActionIntervalMinutes || 30) === opt.value
                          ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                          : "bg-[#22242B] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start and End Window */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-[#141518] border border-[#2F323E]">
                <div className="space-y-1">
                  <span className="block text-[10px] font-semibold text-[#8E929E]">De (début) :</span>
                  <input
                    type="time"
                    value={prefs.currentActionStartTime || "09:00"}
                    onChange={(e) => handleUpdatePrefs({ ...prefs, currentActionStartTime: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg bg-[#22242B] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center box-border"
                  />
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-semibold text-[#8E929E]">À (fin) :</span>
                  <input
                    type="time"
                    value={prefs.currentActionEndTime || "22:00"}
                    onChange={(e) => handleUpdatePrefs({ ...prefs, currentActionEndTime: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg bg-[#22242B] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center box-border"
                  />
                </div>
              </div>

              {/* Days selection */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-[#8E929E]">Jours d'activation :</span>
                <div className="flex justify-between gap-1">
                  {DAYS_SHORT.map((d) => {
                    const isSelected = (prefs.currentActionDays || [1, 2, 3, 4, 5]).includes(d.index);
                    return (
                      <button
                        key={d.index}
                        onClick={() => toggleDay(d.index)}
                        className={cn(
                          "w-8 h-8 rounded-full text-xs font-bold transition-all cursor-pointer",
                          isSelected
                            ? "bg-[#D4F63D] text-black ring-2 ring-[#D4F63D]/30"
                            : "bg-[#22242B] text-[#8E929E] hover:text-white"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Test Button */}
              <button
                onClick={handleTestCheckinNotification}
                className="w-full py-2.5 rounded-xl bg-[#22242B] hover:bg-[#2E313C] border border-[#343740] text-xs font-bold text-[#D4F63D] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Tester ce rappel sur mon écran
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. RAPPELS QUOTIDIENS STANDARDS (Matin, Soir, Streak)                     */}
        {/* ========================================================================= */}
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-white">Bilans & Routines quotidiennes</h3>

          <div className="space-y-3 pt-1">
            {/* Morning */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#141518] border border-[#2B2E38]">
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-white">Rappel matinal</div>
                  <div className="text-[10px] text-[#8E929E]">Objectifs du jour</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={prefs.morningReminderTime || "08:00"}
                  onChange={(e) => handleUpdatePrefs({ ...prefs, morningReminderTime: e.target.value })}
                  className="h-7 px-2 rounded-lg bg-[#22242B] border border-[#343740] text-white text-xs font-mono font-bold outline-none text-center"
                />
                <button
                  onClick={() => handleTogglePref("morningReminder")}
                  className={cn(
                    "w-9 h-5 rounded-full transition-colors relative cursor-pointer",
                    prefs.morningReminder ? "bg-[#D4F63D]" : "bg-[#282A30]"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full bg-black transition-transform transform",
                      prefs.morningReminder ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Evening */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#141518] border border-[#2B2E38]">
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="text-xs font-bold text-white">Bilan du soir</div>
                  <div className="text-[10px] text-[#8E929E]">Récapitulatif des habitudes</div>
                </div>
              </div>