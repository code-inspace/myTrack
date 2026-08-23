              {/* Half-hour subtle dashed line */}
              <div className="absolute inset-x-0 top-1/2 border-b border-[#16181E]/60 border-dashed" />
            </div>
          ))}

          {/* 5-Min Drag Hover Indicator with Live Snapped Time Tooltip */}
          {dragHoverMinute !== null && (
            <div
              style={{ top: `${dragHoverMinute}px` }}
              className="absolute inset-x-0 z-40 pointer-events-none flex items-center"
            >
              <div className="bg-[#D4F63D] text-black font-mono font-extrabold text-[10px] py-0.5 px-2 rounded-full shadow-lg ml-1">
                ⏱ {formatMinutesToTime(dragHoverMinute)} (5 min)
              </div>
              <div className="flex-1 border-b-2 border-dashed border-[#D4F63D]" />
            </div>
          )}

          {/* Current Live Time Red Line */}
          {isToday && (
            <div
              style={{ top: `${currentTimeMinutes}px` }}
              className="absolute inset-x-0 z-30 flex items-center pointer-events-none"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] -ml-1.5 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div className="flex-1 border-b-2 border-[#EF4444] shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
            </div>
          )}

          {/* Timed Task Blocks (With Overlapping Parallel Column Split) */}
          {(() => {
            interface TimedLayoutItem {
              task: TaskWithCompletion;
              startMins: number;
              endMins: number;
              height: number;
              column: number;
              totalColumns: number;
            }

            const items: TimedLayoutItem[] = tasks
              .map((task) => {
                const startTimeStr = task.effectiveStartTime !== undefined ? task.effectiveStartTime : task.startTime;
                if (!startTimeStr) return null;

                const startMins = parseTimeToMinutes(startTimeStr);
                const endTimeStr = task.effectiveEndTime !== undefined ? task.effectiveEndTime : task.endTime;
                const isRunningNow = isToday && Boolean(task.isActive);

                // If task is running now, dynamically stretch to current red bar (currentTimeMinutes)
                const endMins = isRunningNow
                  ? Math.max(startMins + 10, currentTimeMinutes)
                  : endTimeStr
                  ? parseTimeToMinutes(endTimeStr)
                  : startMins + 60;

                const defaultDuration = Math.max(
                  20,
                  isRunningNow ? currentTimeMinutes - startMins : endMins - startMins
                );
                const isCurrentlyResizing = resizingState?.taskId === task.id;
                const activeHeight = isCurrentlyResizing
                  ? resizingState.currentHeight
                  : Math.max(24, defaultDuration);

                const displayTask: TaskWithCompletion = isRunningNow
                  ? {
                      ...task,
                      effectiveEndTime: formatMinutesToTime(currentTimeMinutes),
                    }
                  : task;

                return {
                  task: displayTask,
                  startMins,
                  endMins: startMins + activeHeight,
                  height: activeHeight,
                  column: 0,
                  totalColumns: 1,
                };
              })
              .filter(Boolean) as TimedLayoutItem[];

            if (items.length === 0) return null;

            // 1. Sort by start time ascending, then by duration descending
            items.sort((a, b) => {
              if (a.startMins !== b.startMins) return a.startMins - b.startMins;
              return (b.endMins - b.startMins) - (a.endMins - a.startMins);
            });

            // 2. Group overlapping tasks into clusters
            const clusters: TimedLayoutItem[][] = [];
            let currentCluster: TimedLayoutItem[] = [];
            let clusterEnd = 0;

            for (const item of items) {
              if (currentCluster.length === 0) {
                currentCluster.push(item);
                clusterEnd = item.endMins;
              } else if (item.startMins < clusterEnd) {
                // Overlaps with current cluster
                currentCluster.push(item);
                clusterEnd = Math.max(clusterEnd, item.endMins);
              } else {
                clusters.push(currentCluster);
                currentCluster = [item];
                clusterEnd = item.endMins;
              }
            }
            if (currentCluster.length > 0) {
              clusters.push(currentCluster);
            }

            // 3. For each cluster, allocate columns (greedy non-overlapping placement)
            for (const cluster of clusters) {
              const columns: TimedLayoutItem[][] = [];

              for (const item of cluster) {
                let placed = false;
                for (let c = 0; c < columns.length; c++) {
                  const lastInCol = columns[c][columns[c].length - 1];
                  if (lastInCol.endMins <= item.startMins) {
                    columns[c].push(item);
                    item.column = c;
                    placed = true;
                    break;
                  }
                }
                if (!placed) {
                  columns.push([item]);
                  item.column = columns.length - 1;
                }
              }

              const totalCols = columns.length;
              for (const item of cluster) {
                item.totalColumns = totalCols;
              }
            }

            // 4. Render side-by-side parallel task blocks
            return items.map((item) => {
              const widthPercent = 100 / (item.totalColumns || 1);
              const leftPercent = (item.column || 0) * widthPercent;

              return (
                <AgendaTaskBlock
                  key={item.task.id}
                  task={item.task}
                  topOffsetPx={item.startMins}
                  heightPx={item.height}
                  leftPercent={leftPercent}
                  widthPercent={widthPercent}
                  isSelected={selectedTaskId === item.task.id || resizingState?.taskId === item.task.id}
                  onToggleComplete={onToggleComplete}
                  onToggleReminder={onToggleReminder}
                  onEditTask={onEditTask}
                  onDragStart={onDragStartTask}
                  onClick={() => {
                    setSelectedTaskId(item.task.id);
                    onSelectTask?.(item.task);
                  }}
                  onStartResize={handleStartResize}
                />
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};
