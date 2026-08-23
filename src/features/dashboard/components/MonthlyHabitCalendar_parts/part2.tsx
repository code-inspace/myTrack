                </div>
              );
            }

            return (
              <div
                key={index}
                className={cn(
                  "aspect-square rounded-xl p-1 flex flex-col items-center justify-between transition-all relative",
                  isDone
                    ? "bg-[#D4F63D] text-black shadow-md font-extrabold"
                    : isScheduled
                    ? "bg-[#252830] text-white border border-[#343740]"
                    : "bg-[#141518] text-[#8E929E] border border-[#202228]",
                  isCurrentDay ? "ring-2 ring-white" : ""
                )}
                title={`${format(d, "d MMMM", { locale: fr })}: ${
                  isDone ? "✓ Fait" : isScheduled ? "✗ Non fait" : "Non planifié"
                }`}
              >
                <span className="text-[10px] font-mono leading-none">
                  {format(d, "d")}
                </span>

                <div className="flex items-center justify-center">
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 stroke-[3.5] text-black" />
                  ) : isScheduled ? (
                    <X className="w-2.5 h-2.5 text-[#8E929E] stroke-[2]" />
                  ) : (
                    <span className="text-[10px] opacity-20">•</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="pt-2 border-t border-[#282A30] flex items-center justify-center gap-4 text-[10px] text-[#8E929E]">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4F63D]" />
          <span>Fait</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#252830] border border-[#343740]" />
          <span>Manqué</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#141518]" />
          <span>Non planifié</span>
        </div>
      </div>
    </div>
  );
};
