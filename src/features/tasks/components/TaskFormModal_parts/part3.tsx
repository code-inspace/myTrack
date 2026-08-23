                  ))}
                </div>

                {/* Target & Unit Inputs */}
                {trackingType !== "BOOLEAN" && (
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#17181D] border border-[#343740]">
                    <div>
                      <label className="block text-xs font-semibold text-[#8E929E] mb-1">
                        Objectif cible
                      </label>
                      <input
                        type="number"
                        placeholder="ex: 50"
                        value={targetValue || ""}
                        onChange={(e) => setTargetValue(parseFloat(e.target.value) || undefined)}
                        className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8E929E] mb-1">
                        Unité
                      </label>
                      <input
                        type="text"
                        placeholder="ex: reps, pages"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#343740] text-white text-sm focus:border-[#D4F63D] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. SECTION EXPANDABLE: Récurrence (Défaut : Une fois)                     */}
          {/* ========================================================================= */}
          <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection("recurrence")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Repeat className="w-4 h-4 text-[#D4F63D]" />
                <span className="text-xs font-bold text-white">Récurrence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
                  {currentRecurrenceObj.label}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                    expandedSections.recurrence ? "rotate-180 text-white" : ""
                  )}
                />
              </div>
            </button>

            {expandedSections.recurrence && (
              <div className="p-3.5 pt-2 border-t border-[#2B2E39] space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-wrap gap-2">
                  {RECURRENCE_OPTIONS.map((rec) => (
                    <button
                      type="button"
                      key={rec.id}
                      onClick={() => setRecurrence(rec.id as any)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                        recurrence === rec.id
                          ? "bg-[#D4F63D] text-black border-[#D4F63D] font-bold shadow-sm"
                          : "bg-[#1C1D22] border-[#343740] text-[#D1D5DB] hover:border-[#4B5563]"
                      )}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>

                {/* Custom days selection */}
                {recurrence === "CUSTOM" && (
                  <div className="flex justify-between gap-1.5 pt-3 border-t border-[#343740]">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = selectedDays.includes(d.dayIndex);
                      return (
                        <button
                          type="button"
                          key={d.dayIndex}
                          onClick={() => toggleDay(d.dayIndex)}
                          className={cn(
                            "w-9 h-9 rounded-full text-xs font-bold transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#D4F63D] text-black ring-2 ring-[#D4F63D]/40"
                              : "bg-[#1C1D22] text-[#8E929E] hover:text-white"
                          )}
                        >
                          {d.short[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 5. SECTION EXPANDABLE: Programmation horaire (Jour entier vs Heure)       */}
          {/* ========================================================================= */}
          <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection("schedule")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#D4F63D]" />
                <span className="text-xs font-bold text-white">Programmation horaire</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
                  {hasScheduledTime ? `${startTime} - ${endTime}` : "Jour entier"}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                    expandedSections.schedule ? "rotate-180 text-white" : ""
                  )}
                />
              </div>
            </button>

            {expandedSections.schedule && (
              <div className="p-3.5 pt-2 border-t border-[#2B2E39] space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHasScheduledTime(false)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                      !hasScheduledTime
                        ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                        : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                    )}
                  >
                    <CalendarDays className="w-4 h-4 text-[#D4F63D] flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-white">Jour entier</div>
                      <div className="text-[10px] text-[#8E929E]">Sans heure fixe</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasScheduledTime(true)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                      hasScheduledTime
                        ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                        : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                    )}
                  >
                    <Clock className="w-4 h-4 text-[#D4F63D] flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-white">Heure précise</div>
                      <div className="text-[10px] text-[#8E929E]">Plage horaire</div>
                    </div>
                  </button>
                </div>

                {/* Responsive time inputs formatted cleanly side-by-side */}
                {hasScheduledTime && (
                  <div className="p-3 rounded-2xl bg-[#17181D] border border-[#2F323E] overflow-hidden">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex-1 min-w-0 space-y-1">
                        <label className="block text-[11px] font-semibold text-[#8E929E] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#D4F63D]" />
                          <span>Début</span>
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => handleStartTimeChange(e.target.value)}
                          className="w-full h-10 px-2.5 rounded-xl bg-[#252830] border border-[#343740] text-white font-mono font-bold text-sm focus:border-[#D4F63D] outline-none text-center box-border"
                        />
                      </div>

                      <div className="text-xs text-[#8E929E] font-bold pt-4">➔</div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <label className="block text-[11px] font-semibold text-[#8E929E] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#8E929E]" />
                          <span>Fin</span>
                        </label>
                        <input
                          type="time"