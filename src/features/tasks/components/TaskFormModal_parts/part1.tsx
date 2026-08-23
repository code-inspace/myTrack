"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task, TaskFormValues, TaskWithCompletion } from "../types";
import { TASK_CATEGORIES, TRACKING_TYPE_OPTIONS, RECURRENCE_OPTIONS, DAYS_OF_WEEK } from "../options";
import { getTodayDateString } from "@/lib/dates";
import {
  X,
  Plus,
  Check,
  Edit3,
  Clock,
  CalendarDays,
  BellRing,
  Trash2,
  ChevronDown,
  Tag,
  Sliders,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskFormModalProps {
  isOpen: boolean;
  initialTask?: Task | TaskWithCompletion | null;
  onClose: () => void;
  onSubmit: (values: TaskFormValues, taskId?: string) => void;
}

function addHoursToTimeString(timeStr: string, hoursToAdd: number = 1): string {
  if (!timeStr || !timeStr.includes(":")) return "08:00";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const totalMinutes = (h * 60 + m + hoursToAdd * 60) % (24 * 60);
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function subtractMinutesFromTime(timeStr: string, minutesToSubtract: number): string {
  if (!timeStr || !timeStr.includes(":")) return "08:50";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  let totalMinutes = h * 60 + m - minutesToSubtract;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

const OFFSET_OPTIONS = [
  { value: 0, label: "À l'heure pile" },
  { value: 5, label: "5 min avant" },
  { value: 10, label: "10 min avant (défaut)" },
  { value: 15, label: "15 min avant" },
  { value: 30, label: "30 min avant" },
  { value: 60, label: "1h avant" },
];

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  initialTask,
  onClose,
  onSubmit,
}) => {
  const isEditing = Boolean(initialTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [trackingType, setTrackingType] = useState<"BOOLEAN" | "NUMBER" | "DURATION" | "QUANTITY">("BOOLEAN");
  const [targetValue, setTargetValue] = useState<number | undefined>(undefined);
  const [unit, setUnit] = useState<string>("");
  const [hasScheduledTime, setHasScheduledTime] = useState<boolean>(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<"ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM">("ONCE");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);  const [targetDate, setTargetDate] = useState<string>(() => {
    return (initialTask as any)?.date || (initialTask?.createdAt ? initialTask.createdAt.split("T")[0] : getTodayDateString());
  });

  // Notifications & Reminders State
  const [enableReminders, setEnableReminders] = useState<boolean>(true);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(10);
  const [reminderTimes, setReminderTimes] = useState<string[]>(["11:00", "18:00"]);

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: false,
    tracking: false,
    recurrence: false,
    schedule: false,
    reminders: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const prevIsOpenRef = useRef(false);
  const prevTaskIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Only synchronize/reset form fields when modal opens or when editing a different task
    if (isOpen && (!prevIsOpenRef.current || prevTaskIdRef.current !== initialTask?.id)) {
      if (initialTask) {
        setTitle(initialTask.title || "");
        setDescription(initialTask.description || "");
        setCategory(initialTask.category || "General");
        setTrackingType(initialTask.trackingType || "BOOLEAN");
        setTargetValue(initialTask.targetValue || undefined);
        setUnit(initialTask.unit || "");
        const taskHasTime = Boolean(initialTask.startTime);
        setHasScheduledTime(taskHasTime);
        setStartTime(initialTask.startTime || "09:00");
        setEndTime(
          initialTask.endTime ||
            (initialTask.startTime ? addHoursToTimeString(initialTask.startTime, 1) : "10:00")
        );
        setTargetDate((initialTask as any)?.date || (initialTask?.createdAt ? initialTask.createdAt.split("T")[0] : getTodayDateString()));
        setRecurrence(initialTask.recurrence || "ONCE");
        setSelectedDays(initialTask.recurrenceConfig?.days || [1, 2, 3, 4, 5]);
        setEnableReminders(initialTask.enableReminders !== undefined ? initialTask.enableReminders : true);
        setReminderOffsetMinutes(initialTask.reminderOffsetMinutes ?? 10);
        setReminderTimes(
          initialTask.reminderTimes && initialTask.reminderTimes.length > 0
            ? initialTask.reminderTimes
            : ["11:00", "18:00"]
        );
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
        setEnableReminders(true);
        setReminderOffsetMinutes(10);
        setReminderTimes(["11:00", "18:00"]);
      }
    }
    prevIsOpenRef.current = isOpen;
    prevTaskIdRef.current = initialTask?.id;
  }, [isOpen, initialTask]);

  if (!isOpen) return null;

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (newStart) {
      const computedEnd = addHoursToTimeString(newStart, 1);
      setEndTime(computedEnd);
    }
  };

  const handleAddAllDayReminder = () => {
    const nextHour = reminderTimes.length === 0 ? "11:00" : reminderTimes.length === 1 ? "18:00" : "20:00";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        trackingType,
        targetValue: trackingType !== "BOOLEAN" ? targetValue : undefined,
        unit: trackingType !== "BOOLEAN" ? (unit || "reps") : undefined,
        startTime: hasScheduledTime && startTime ? startTime : undefined,
        endTime: hasScheduledTime && endTime ? endTime : undefined,
        date: targetDate,
        recurrence,
        recurrenceConfig: recurrence === "CUSTOM" ? { days: selectedDays } : undefined,
        enableReminders,
        reminderOffsetMinutes: hasScheduledTime ? reminderOffsetMinutes : undefined,