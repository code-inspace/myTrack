            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Level 2: Metadata Badges (Hours, Recurrence, Category) & Action Controls */}
      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#252830] text-xs">
        {/* Left Metadata Pills */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          {hasTime ? (
            <span className="inline-flex items-center gap-1 bg-[#141518] px-2.5 py-1 rounded-lg border border-[#252830] font-semibold text-white text-[11px] whitespace-nowrap">
              <Clock className="w-3 h-3 text-[#D4F63D]" />
              <span>
                {displayStart}
                {displayEnd ? ` - ${displayEnd}` : ""}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-1 rounded-lg border border-[#252830] text-[#8E929E] text-[11px] font-medium whitespace-nowrap">
              <Clock className="w-3 h-3 text-[#6B7280]" />
              <span>Jour entier</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1 bg-[#141518] px-2 py-1 rounded-lg border border-[#252830] text-[#8E929E] text-[11px] font-medium whitespace-nowrap">
            <Repeat className="w-3 h-3 text-[#6B7280]" />
            <span>{RECURRENCE_LABEL_MAP[task.recurrence] || "Quotidien"}</span>
          </span>

          {task.category && task.category !== "General" && (
            <span className="px-2 py-0.5 rounded-md bg-[#252830] text-[#9CA3AF] text-[10px] font-semibold whitespace-nowrap">
              {task.category}
            </span>
          )}
        </div>

        {/* Right Actions: Progression counter placed ABOVE Démarrer */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isQuantitative && (
            <button
              onClick={() => onOpenLogModal(task)}
              className="px-2.5 py-1 rounded-xl bg-[#252830] hover:bg-[#343740] text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer border border-[#383C48]"
              title="Modifier la progression"
            >
              <span className={cn(task.currentValue ? "text-[#D4F63D]" : "text-[#9CA3AF]")}>
                {task.currentValue ?? 0}
              </span>
              {task.targetValue && (
                <span className="text-[#6B7280]">/ {task.targetValue}</span>
              )}
              {task.unit && <span className="text-[#9CA3AF] text-[10px]">{task.unit}</span>}
              <Plus className="w-3 h-3 text-[#D4F63D] ml-0.5" />
            </button>
          )}

          {!isCompleted && (
            <button
              onClick={() => onToggleActive(task.id)}
              className="px-4 py-1.5 rounded-full bg-[#D4F63D] hover:bg-[#c2e42f] text-black font-extrabold text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Démarrer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
