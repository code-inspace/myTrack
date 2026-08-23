                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveTask(idx)}
                  className="p-1 text-[#6B7280] hover:text-red-400 transition-colors rounded-lg hover:bg-[#252830] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-[#252832]">
          <button
            type="button"
            disabled={parsedTasks.length === 0}
            onClick={handleConfirmAdd}
            className={cn(
              "w-full py-3.5 rounded-2xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
              parsedTasks.length > 0
                ? "bg-[#D4F63D] hover:bg-[#c2e432] text-black active:scale-98"
                : "bg-[#252830] text-[#6B7280] cursor-not-allowed"
            )}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {parsedTasks.length > 1
                ? `Ajouter les ${parsedTasks.length} actions (1 clic)`
                : parsedTasks.length === 1
                ? "Ajouter l'action"
                : "Parle pour détecter des actions"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
