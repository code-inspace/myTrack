          title={
            activeTab === "habits"
              ? "Mes Habitudes"
              : activeTab === "agenda"
              ? "Mon Agenda"
              : activeTab === "sleep"
              ? "Sommeil"
              : "Journal & Bilan"
          }
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onNewTask={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
        />

        {/* Fixed "Jour entier" Section when in Agenda mode */}
        {activeTab === "agenda" && (
          <AllDaySection
            tasks={allDayTasks}
            onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
            onToggleReminder={(taskId) => {
              const target = tasks.find((t) => t.id === taskId) || allTasks.find((t) => t.id === taskId);
              const newEnable = target ? !(target.enableReminders !== false) : true;
              updateTask.mutate({ taskId, values: { enableReminders: newEnable } });
            }}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onDropToAllDay={handleDropToAllDay}
            onDragStartTask={handleDragStartTask}
          />
        )}
      </div>

      {/* 2. Seamless View Body */}
      {activeTab === "bilan" ? (
        /* BILAN & GRATITUDE & MANIFESTATION TAB */
        <DailyBilanView selectedDate={selectedDate} />
      ) : activeTab === "sleep" ? (
        /* SOMMEIL TAB */
        <SleepJournalView selectedDate={selectedDate} />
      ) : activeTab === "habits" ? (
        /* HABIT LIST TAB */
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-36 space-y-3.5 max-w-md mx-auto w-full touch-pan-y"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Aujourd'hui</h2>
          </div>

          {/* Quick Task Input Bar */}
          <form onSubmit={handleQuickAdd} className="w-full relative">
            <div className="relative flex items-center">
              <div className="absolute left-4 text-[#D4F63D]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Nom de la tâche"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#1C1D22] border border-[#282A30] text-sm text-white focus:border-[#D4F63D] outline-none placeholder-[#6B7280] shadow-sm transition-all"
              />
            </div>
          </form>

          {/* Active Running Task Banners */}
          {activeTasksMapped.length > 0 && (
            <div className="space-y-3">
              {activeTasksMapped.map((activeItem) => (
                <ActiveTaskBanner
                  key={activeItem.id}
                  task={activeItem}
                  onStop={(taskId) => toggleTaskActive.mutate({ taskId, date: selectedDate })}
                  onComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
                  onOpenLogModal={(t) => setSelectedLoggingTask(t)}
                  onUpdateStartTime={(taskId, newTime) =>
                    updateTaskStartedAt.mutate({ taskId, startedAtTime: newTime })
                  }
                />
              ))}
            </div>
          )}

          {/* Tasks List with Drag & Drop Reordering */}
          <div className="space-y-2.5 pt-1">
            {orderedTasks.length === 0 ? (
              <div className="p-8 text-center bg-[#1C1D22] border border-[#282A30] rounded-3xl my-4">
                <Inbox className="w-10 h-10 text-[#6B7280] mx-auto mb-2" />
                <h4 className="text-base font-bold text-white">Aucune tâche programmée</h4>
                <p className="text-xs text-[#8E929E] mt-1 mb-4">
                  Tu n'as aucune tâche active pour cette date.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setIsTaskModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-full bg-[#D4F63D] text-black font-bold text-xs cursor-pointer"
                >
                  Créer une tâche
                </button>
              </div>
            ) : (
              orderedTasks.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  isDraggable={true}
                  isDragging={draggedIndex === idx}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onToggleActive={(id) => toggleTaskActive.mutate({ taskId: id, date: selectedDate })}
                  onToggleComplete={(id) => toggleCompletion.mutate({ taskId: id, date: selectedDate })}
                  onToggleReminder={(id) => {
                    const target = tasks.find((t) => t.id === id);
                    const newEnable = target ? !(target.enableReminders !== false) : true;
                    updateTask.mutate({ taskId: id, values: { enableReminders: newEnable } });
                  }}
                  onOpenLogModal={(t) => setSelectedLoggingTask(t)}
                  onEditTask={(t) => {
                    setEditingTask(t);
                    setIsTaskModalOpen(true);
                  }}
                  onDeleteTask={(id) => deleteTask.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* AGENDA TIMELINE TAB */
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <AgendaTimeline
            selectedDate={selectedDate}
            tasks={timedTasks}
            onToggleComplete={(taskId) => toggleCompletion.mutate({ taskId, date: selectedDate })}
            onToggleReminder={(taskId) => {
              const target = tasks.find((t) => t.id === taskId) || allTasks.find((t) => t.id === taskId);
              const newEnable = target ? !(target.enableReminders !== false) : true;
              updateTask.mutate({ taskId, values: { enableReminders: newEnable } });
            }}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onMoveTaskToTime={handleMoveTaskToTime}
            onDragStartTask={handleDragStartTask}
          />
        </div>
      )}

      {/* Task Creation & Edition Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen || Boolean(editingTask)}
        initialTask={editingTask}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
      />

      {/* Quantity / Duration logging modal */}
      <QuantityLoggingModal
        task={selectedLoggingTask}
        isOpen={Boolean(selectedLoggingTask)}
        onClose={() => setSelectedLoggingTask(null)}
        onSaveValue={(taskId, value) => {
          updateCompletionValue.mutate({ taskId, date: selectedDate, value });
        }}
      />

      {/* Actionable Notification Simulation Sheet */}
      <InteractiveNotificationSheet
        isOpen={isTestNotificationOpen}
        question="As-tu fait tes pompes aujourd'hui ?"
        taskTitle="Pompes"
        onClose={() => setIsTestNotificationOpen(false)}
        onRespond={handleInteractiveResponse}
      />

      {/* Dual Floating Action Buttons: New Task (+) and Voice AI (Mic) */}
      <VoiceFab
        selectedDate={selectedDate}
        onNewTask={() => {
          setEditingTask(null);
          setIsTaskModalOpen(true);
        }}
      />
    </div>