          )}

          {/* Explicit Edit Button */}
          {onEditTask && !isVeryNarrow && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              title="Modifier l'événement"
              className="p-0.5 text-[#8E929E] hover:text-[#D4F63D] hover:scale-110 transition-all rounded-lg cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}

          {/* Completion check */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            className="p-0.5 text-[#D4F63D] hover:scale-110 transition-transform cursor-pointer"
          >
            {task.isCompletedToday ? (
              <CheckCircle2 className={cn(isVeryNarrow ? "w-3 h-3" : "w-3.5 h-3.5", "fill-[#D4F63D]/20 text-[#D4F63D]")} />
            ) : (
              <Circle className={cn(isVeryNarrow ? "w-3 h-3" : "w-3.5 h-3.5", "text-[#8E929E]")} />
            )}
          </button>
        </div>
      </div>

      {/* Interactive Bottom Resize Handle for stretching / compressing duration */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartResize?.(e, task);
        }}
        className={cn(
          "absolute bottom-0 inset-x-0 h-4 flex items-center justify-center cursor-ns-resize z-40 bg-gradient-to-t from-black/50 to-transparent rounded-b-xl transition-all",
          isSelected
            ? "opacity-100 bg-[#D4F63D]/20"
            : "opacity-0 group-hover:opacity-100 hover:bg-[#D4F63D]/20"
        )}
        title="Glisser vers le bas/haut pour étendre ou compresser la durée"
      >
        <div className="w-10 h-1 bg-[#D4F63D] rounded-full shadow-lg" />
      </div>
    </div>
  );
};
