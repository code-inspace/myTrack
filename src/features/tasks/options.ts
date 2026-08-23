export const TASK_CATEGORIES = [
  { id: "Fitness", label: "Fitness & Sport", icon: "Dumbbell", color: "#D4F63D" },
  { id: "Health", label: "Health & Nutrition", icon: "Heart", color: "#34D399" },
  { id: "Productivity", label: "Productivity & Work", icon: "Briefcase", color: "#60A5FA" },
  { id: "Learning", label: "Learning & Reading", icon: "BookOpen", color: "#F472B6" },
  { id: "Mindfulness", label: "Mindfulness & Sleep", icon: "Sparkles", color: "#A78BFA" },
  { id: "General", label: "General", icon: "CheckCircle", color: "#9CA3AF" },
] as const;

export const TRACKING_TYPE_OPTIONS = [
  { id: "BOOLEAN", label: "Simple completion", description: "Done or not done", defaultUnit: null },
  { id: "NUMBER", label: "Number / Reps", description: "Target count (e.g. 50 pushups)", defaultUnit: "reps" },
  { id: "DURATION", label: "Duration / Timer", description: "Target time (e.g. 60 min)", defaultUnit: "min" },
  { id: "QUANTITY", label: "Quantity / Volume", description: "Target measure (e.g. 2 liters, 20 pages)", defaultUnit: "units" },
] as const;

export const RECURRENCE_OPTIONS = [
  { id: "DAILY", label: "Daily" },
  { id: "WEEKDAYS", label: "Mon - Fri" },
  { id: "WEEKLY", label: "Weekly" },
  { id: "CUSTOM", label: "Custom days" },
  { id: "ONCE", label: "Once" },
] as const;

export const DAYS_OF_WEEK = [
  { dayIndex: 1, short: "Mon", full: "Monday" },
  { dayIndex: 2, short: "Tue", full: "Tuesday" },
  { dayIndex: 3, short: "Wed", full: "Wednesday" },
  { dayIndex: 4, short: "Thu", full: "Thursday" },
  { dayIndex: 5, short: "Fri", full: "Friday" },
  { dayIndex: 6, short: "Sat", full: "Saturday" },
  { dayIndex: 0, short: "Sun", full: "Sunday" },
] as const;
