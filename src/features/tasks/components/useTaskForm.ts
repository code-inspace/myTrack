"use client";

import { useState, useEffect, useRef } from "react";
import { Task, TaskFormValues, TaskWithCompletion } from "../types";
import { useTaskMutations } from "../hooks";
import { getTodayDateString, addHoursToTimeString } from "@/lib/dates";
import { DEFAULT_PROJECT_COLUMNS } from "@/features/projects/types";
import { TaskPriority } from "@/features/tasks/priority";
import { isNapTitle, isSleepTitle, extractTimesFromTitle } from "@/features/sleep/actions";

interface UseTaskFormProps {
  isOpen: boolean;
  initialTask?: Task | TaskWithCompletion | null;
  onSubmit: (values: TaskFormValues, taskId?: string) => void;
  onClose: () => void;
}

export function useTaskForm({
  isOpen,
  initialTask,
  onSubmit,
  onClose,
}: UseTaskFormProps) {
  const isEditing = Boolean(initialTask && initialTask.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("General");
  const category = tag;
  const setCategory = setTag;

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (tag === "General" || !tag || tag === "Santé") {
      if (isNapTitle(newTitle)) {
        setTag("Santé");
        const parsed = extractTimesFromTitle(newTitle);
        if (!hasScheduledTime) {
          setHasScheduledTime(true);
          setStartTime(parsed.startTime || "13:30");
          setEndTime(parsed.endTime || "14:00");
          setTrackingType("DURATION");
          setTargetValue(30);
        } else if (parsed.startTime) {
          setStartTime(parsed.startTime);
          if (parsed.endTime) setEndTime(parsed.endTime);
        }
      } else if (isSleepTitle(newTitle)) {
        setTag("Santé");
        const parsed = extractTimesFromTitle(newTitle);
        if (!hasScheduledTime) {
          setHasScheduledTime(true);
          setStartTime(parsed.startTime || "23:00");
          setEndTime(parsed.endTime || "07:00");
          setTrackingType("DURATION");
          setTargetValue(480);
        } else if (parsed.startTime) {
          setStartTime(parsed.startTime);
          if (parsed.endTime) setEndTime(parsed.endTime);
        }
      }
    }
  };
  const [trackingType, setTrackingType] = useState<
    "BOOLEAN" | "NUMBER" | "DURATION" | "QUANTITY"
  >("BOOLEAN");
  const [targetValue, setTargetValue] = useState<number | undefined>(undefined);
  const [unit, setUnit] = useState<string>("");
  const [hasScheduledTime, setHasScheduledTime] = useState<boolean>(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<
    "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM"
  >("ONCE");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetDate, setTargetDate] = useState<string>(() => {
    return (
      (initialTask as any)?.date ||
      (initialTask?.createdAt
        ? initialTask.createdAt.split("T")[0]
        : getTodayDateString())
    );
  });
  const [deadline, setDeadline] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");

  // Notifications & Reminders
  const [enableReminders, setEnableReminders] = useState<boolean>(false);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(10);
  const [reminderTimes, setReminderTimes] = useState<string[]>(["11:00", "18:00"]);

  // Project assignment
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<string>(DEFAULT_PROJECT_COLUMNS[0].id);
  const [projectCategory, setProjectCategory] = useState<string>("");
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

  const { updateTask } = useTaskMutations();

  // Accordion sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    priority: false,
    category: false,
    tracking: false,
    recurrence: false,
    schedule: false,
    reminders: false,
    project: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const prevIsOpenRef = useRef(false);
  const prevTaskIdRef = useRef<string | null | undefined>(undefined);

  // Sync state when modal opens or initialTask changes
  useEffect(() => {
    if (
      isOpen &&
      (!prevIsOpenRef.current || prevTaskIdRef.current !== initialTask?.id)
    ) {
      if (initialTask) {
        setTitle(initialTask.title || "");
        setDescription(initialTask.description || "");
        setCategory(initialTask.category || "General");
        setTrackingType(initialTask.trackingType || "BOOLEAN");
        setTargetValue(initialTask.targetValue || undefined);
        setUnit(initialTask.unit || "");
        const initialStartTime = (initialTask as TaskWithCompletion).effectiveStartTime !== undefined
          ? (initialTask as TaskWithCompletion).effectiveStartTime
          : initialTask.startTime;
        const initialEndTime = (initialTask as TaskWithCompletion).effectiveEndTime !== undefined
          ? (initialTask as TaskWithCompletion).effectiveEndTime
          : initialTask.endTime;
        const taskHasTime = Boolean(initialStartTime);
        setHasScheduledTime(taskHasTime);
        setStartTime(initialStartTime || "09:00");
        setEndTime(
          initialEndTime ||
            (initialStartTime
              ? addHoursToTimeString(initialStartTime, 1)
              : "10:00"),
        );
        setTargetDate(
          (initialTask as any)?.date ||
            (initialTask?.createdAt
              ? initialTask.createdAt.split("T")[0]
              : getTodayDateString()),
        );
        setRecurrence(initialTask.recurrence || "ONCE");
        setSelectedDays(initialTask.recurrenceConfig?.days || [1, 2, 3, 4, 5]);
        setEnableReminders(
          initialTask.enableReminders !== undefined
            ? initialTask.enableReminders
            : false,
        );
        setReminderOffsetMinutes(initialTask.reminderOffsetMinutes ?? 10);
        setReminderTimes(
          initialTask.reminderTimes && initialTask.reminderTimes.length > 0
            ? initialTask.reminderTimes
            : ["11:00", "18:00"],
        );
        const initPid = initialTask.projectId || null;
        setProjectId(initPid);
        setProjectStatus(
          initialTask.projectStatus || DEFAULT_PROJECT_COLUMNS[0].id,
        );
        setProjectCategory(initPid ? (initialTask.projectCategory || "") : "");
        setDeadline(initialTask.deadline || "");
        setPriority((initialTask.priority as TaskPriority) || "NORMAL");
        skipNextAutoSaveRef.current = true;
      } else {
        setTitle("");
        setDescription("");
        setCategory("General");
        setTrackingType("BOOLEAN");
        setTargetValue(undefined);
        setUnit("");
        setHasScheduledTime(false);
        setStartTime("09:00");
        setEndTime("10:00");
        setTargetDate(getTodayDateString());
        setRecurrence("ONCE");
        setSelectedDays([1, 2, 3, 4, 5]);
        setEnableReminders(false);
        setReminderOffsetMinutes(10);
        setReminderTimes(["11:00", "18:00"]);
        setProjectId(null);
        setProjectStatus(DEFAULT_PROJECT_COLUMNS[0].id);
        setProjectCategory("");
        setDeadline("");
        setPriority("NORMAL");
      }
    }
    prevIsOpenRef.current = isOpen;
    prevTaskIdRef.current = initialTask?.id;
  }, [isOpen, initialTask]);

  const buildFormValues = (): TaskFormValues => ({
    title: title.trim(),
    description: description.trim() || undefined,
    tag,
    category: tag,
    trackingType,
    targetValue: trackingType !== "BOOLEAN" ? targetValue : undefined,
    unit: trackingType !== "BOOLEAN" ? unit || "reps" : undefined,
    startTime: hasScheduledTime && startTime ? startTime : undefined,
    endTime: hasScheduledTime && endTime ? endTime : undefined,
    date: targetDate,
    deadline: deadline || null,
    priority,
    recurrence,
    recurrenceConfig:
      recurrence === "CUSTOM" ? { days: selectedDays } : undefined,
    enableReminders,
    reminderOffsetMinutes: hasScheduledTime ? reminderOffsetMinutes : undefined,
    reminderTimes: !hasScheduledTime ? reminderTimes : undefined,
    projectId: projectId || null,
    projectStatus: projectId ? projectStatus : null,
    projectCategory: projectId && projectCategory.trim() ? projectCategory.trim() : null,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(buildFormValues(), initialTask?.id);
    onClose();
  };

  const handleCloseWhileEditing = () => {
    if (title.trim() && isEditing && initialTask?.id) {
      onSubmit(buildFormValues(), initialTask.id);
    }
    onClose();
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (newStart) {
      const computedEnd = addHoursToTimeString(newStart, 1);
      setEndTime(computedEnd);
    }
  };

  const handleAddAllDayReminder = () => {
    const nextHour =
      reminderTimes.length === 0
        ? "11:00"
        : reminderTimes.length === 1
          ? "18:00"
          : "20:00";
    setReminderTimes([...reminderTimes, nextHour]);
  };

  const handleRemoveAllDayReminder = (index: number) => {
    setReminderTimes(reminderTimes.filter((_, idx) => idx !== index));
  };

  const handleUpdateAllDayReminderTime = (index: number, newTime: string) => {
    const updated = [...reminderTimes];
    updated[index] = newTime;
    setReminderTimes(updated);
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex]);
    }
  };

  const handleSetProjectId = (newProjectId: string | null) => {
    setProjectId((prev) => {
      if (prev !== newProjectId) {
        setProjectCategory("");
      }
      return newProjectId;
    });
  };

  return {
    isEditing,
    // Fields
    title,
    setTitle: handleTitleChange,
    description,
    setDescription,
    tag,
    setTag,
    category,
    setCategory,
    trackingType,
    setTrackingType,
    targetValue,
    setTargetValue,
    unit,
    setUnit,
    hasScheduledTime,
    setHasScheduledTime,
    startTime,
    setStartTime,
    handleStartTimeChange,
    endTime,
    setEndTime,
    recurrence,
    setRecurrence,
    selectedDays,
    toggleDay,
    targetDate,
    setTargetDate,
    deadline,
    setDeadline,
    priority,
    setPriority,
    // Reminders
    enableReminders,
    setEnableReminders,
    reminderOffsetMinutes,
    setReminderOffsetMinutes,
    reminderTimes,
    handleAddAllDayReminder,
    handleRemoveAllDayReminder,
    handleUpdateAllDayReminderTime,
    // Project
    projectId,
    setProjectId: handleSetProjectId,
    projectStatus,
    setProjectStatus,
    projectCategory,
    setProjectCategory,
    isNewProjectOpen,
    setIsNewProjectOpen,
    // Accordion
    expandedSections,
    toggleSection,
    // Handlers
    handleSubmit,
    handleCloseWhileEditing,
  };
}

export type TaskFormState = ReturnType<typeof useTaskForm>;
