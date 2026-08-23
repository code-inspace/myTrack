        reminderTimes: !hasScheduledTime ? reminderTimes : undefined,
      },
      initialTask?.id
    );

    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex]);
    }
  };

  // Helper labels for collapsed summaries
  const currentCategoryObj = TASK_CATEGORIES.find((c) => c.id === category) || TASK_CATEGORIES[0];
  const currentTrackingObj = TRACKING_TYPE_OPTIONS.find((t) => t.id === trackingType) || TRACKING_TYPE_OPTIONS[0];
  const currentRecurrenceObj = RECURRENCE_OPTIONS.find((r) => r.id === recurrence) || RECURRENCE_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1C1D22] border border-[#282A30] rounded-3xl p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto my-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#282A30]">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit3 className="w-5 h-5 text-[#D4F63D]" />
                  <span>Modifier l'habitude</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-[#D4F63D]" />
                  <span>Créer une nouvelle tâche</span>
                </>
              )}
            </h2>
            <p className="text-xs text-[#8E929E] mt-0.5">
              {isEditing
                ? "Modifie les paramètres et enregistre dans Supabase"
                : "Définis ton habitude ou ton action"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E929E] hover:text-white p-2 rounded-full bg-[#252830] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Main Task Name Input (Always Visible) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E929E]">
              Nom de la tâche *
            </label>
            <input
              type="text"
              required
              placeholder="ex: Pompes, Lire 20 pages, Deep work..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#252830] border border-[#343740] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
            />
          </div>

          {/* Description (Optional, Always Visible) */}
          <div>
            <input
              type="text"
              placeholder="Description ou notes (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#252830]/60 border border-[#343740] focus:border-[#D4F63D] text-xs text-white outline-none transition-all placeholder-[#6B7280]"
            />
          </div>

          {/* Date Picker Field */}
          <div className="p-3 rounded-2xl bg-[#22242B] border border-[#2F323E] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4 text-[#D4F63D]" />
              <div>
                <div className="text-xs font-bold text-white">Date de la tâche</div>
                <div className="text-[10px] text-[#8E929E]">Jour d'exécution ou départ</div>
              </div>
            </div>

            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#252830] border border-[#343740] text-white text-xs font-mono font-bold focus:border-[#D4F63D] outline-none text-center cursor-pointer"
            />
          </div>

          {/* ========================================================================= */}
          {/* 2. SECTION EXPANDABLE: Catégorie                                          */}
          {/* ========================================================================= */}
          <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection("category")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-[#D4F63D]" />
                <span className="text-xs font-bold text-white">Catégorie</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
                  {currentCategoryObj.label.split(" ")[0]}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                    expandedSections.category ? "rotate-180 text-white" : ""
                  )}
                />
              </div>
            </button>

            {expandedSections.category && (
              <div className="p-3.5 pt-1 border-t border-[#2B2E39] grid grid-cols-3 gap-2 animate-in fade-in duration-150">
                {TASK_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id);
                      toggleSection("category");
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center truncate cursor-pointer",
                      category === cat.id
                        ? "bg-[#D4F63D]/15 border-[#D4F63D] text-[#D4F63D]"
                        : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                    )}
                  >
                    {cat.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. SECTION EXPANDABLE: Type de suivi                                      */}
          {/* ========================================================================= */}
          <div className="rounded-2xl bg-[#22242B] border border-[#2F323E] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => toggleSection("tracking")}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#282B35] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-[#D4F63D]" />
                <span className="text-xs font-bold text-white">Type de suivi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#17181D] text-[#D4F63D] border border-[#2E323E]">
                  {trackingType === "BOOLEAN"
                    ? "Oui / Non"
                    : `${targetValue ?? ""} ${unit || currentTrackingObj.defaultUnit || ""}`}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-[#8E929E] transition-transform duration-200",
                    expandedSections.tracking ? "rotate-180 text-white" : ""
                  )}
                />
              </div>
            </button>

            {expandedSections.tracking && (
              <div className="p-3.5 pt-2 border-t border-[#2B2E39] space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  {TRACKING_TYPE_OPTIONS.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => {
                        setTrackingType(t.id as any);
                        if (t.defaultUnit && !unit) setUnit(t.defaultUnit);
                        if (t.id === "NUMBER" && !targetValue) setTargetValue(50);
                        if (t.id === "DURATION" && !targetValue) setTargetValue(30);
                      }}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                        trackingType === t.id
                          ? "bg-[#D4F63D]/10 border-[#D4F63D] text-white ring-1 ring-[#D4F63D]"
                          : "bg-[#1C1D22] border-[#343740] text-[#9CA3AF] hover:border-[#4B5563]"
                      )}
                    >
                      <div className="text-xs font-bold text-white">{t.label}</div>
                      <div className="text-[11px] text-[#8E929E] mt-0.5">{t.description}</div>
                    </button>