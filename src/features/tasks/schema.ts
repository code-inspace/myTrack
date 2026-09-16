import { z } from "zod";

export const TaskFormSchema = z.object({
  title: z.string().min(1, "Task name is required").max(100),
  description: z.string().max(500).optional(),
  tag: z.string().optional().default("General"),
  category: z.string().optional().default("General"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  date: z.string().optional(),
  deadline: z.string().optional().nullable(),
  priority: z.enum(["NORMAL", "URGENT", "VERY_URGENT"]).optional().nullable(),
  recurrence: z.enum(["ONCE", "DAILY", "WEEKDAYS", "WEEKLY", "CUSTOM"]).default("ONCE"),
  recurrenceConfig: z
    .object({
      days: z.array(z.number().min(0).max(6)).optional(),
    })
    .optional()
    .nullable(),
  trackingType: z.enum(["BOOLEAN", "NUMBER", "DURATION", "QUANTITY"]).default("BOOLEAN"),
  targetValue: z.number().positive().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  reminderTime: z.string().optional(),
  enableReminders: z.boolean().optional(),
  reminderOffsetMinutes: z.number().optional().nullable(),
  reminderTimes: z.array(z.string()).optional().nullable(),
  projectId: z.string().optional().nullable(),
  projectStatus: z.string().optional().nullable(),
  projectCategory: z.string().optional().nullable(),
  isNoProject: z.boolean().optional().nullable(),
});

export type TaskFormValues = z.infer<typeof TaskFormSchema>;

export const LogCompletionSchema = z.object({
  taskId: z.string().uuid().or(z.string().min(1)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  completed: z.boolean().default(true),
  value: z.number().optional().nullable(),
  duration: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type LogCompletionValues = z.infer<typeof LogCompletionSchema>;
