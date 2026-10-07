import { NextRequest } from "next/server";
import { getAdminClient, getRequestUserId } from "./serverAuth";
import { getZonedDateTimeParts, isValidTimeZone } from "@/lib/dates";
import { getProjectColumns } from "@/features/projects/types";

export interface WidgetContext {
  userId: string;
  timeZone: string;
  supabase: ReturnType<typeof getAdminClient>;
  /** The user's local calendar date "yyyy-MM-dd" for `instant`. */
  localDate: (instant?: Date) => string;
  /** The UTC "HH:mm" stored in the database for `instant`. */
  utcTime: (instant?: Date) => string;
}

/**
 * Resolves the user and timezone of a native widget / intent request. Widget routes run on the
 * server (UTC), so "today" must come from the user's timezone, never from the server clock.
 */
export async function resolveWidgetContext(
  req: NextRequest,
  body?: { timezone?: string | null } | null,
): Promise<WidgetContext | null> {
  const userId = await getRequestUserId(req, { allowWidgetToken: true });
  if (!userId) return null;

  const supabase = getAdminClient();
  let timeZone = body?.timezone || req.headers.get("x-timezone") || null;
  if (!isValidTimeZone(timeZone)) {
    const { data } = await supabase.from("users").select("timezone").eq("id", userId).maybeSingle();
    timeZone = isValidTimeZone(data?.timezone) ? data!.timezone : "UTC";
  }
  const tz = timeZone as string;

  return {
    userId,
    timeZone: tz,
    supabase,
    localDate: (instant = new Date()) => getZonedDateTimeParts(instant, tz).dateStr,
    utcTime: (instant = new Date()) => getZonedDateTimeParts(instant, "UTC").timeStr,
  };
}

export async function getProjectDoneColumnId(
  supabase: ReturnType<typeof getAdminClient>,
  projectId: string,
): Promise<string> {
  const { data: project } = await supabase
    .from("projects")
    .select("columns")
    .eq("id", projectId)
    .maybeSingle();
  const columns = getProjectColumns({ columns: Array.isArray(project?.columns) ? project.columns : [] });
  return columns.find((c) => c.isDone)?.id || "DONE";
}
