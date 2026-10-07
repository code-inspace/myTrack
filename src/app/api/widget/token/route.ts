import { NextRequest, NextResponse } from "next/server";
import { createWidgetToken, getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";

// GET /api/widget/token — issues the token the native widget/intents send as `X-Widget-Token`.
// Only a real user session can mint one (a widget token can't be used to get another).
export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorizedResponse();

  const token = createWidgetToken(userId);
  if (!token) {
    return NextResponse.json({ error: "Widget tokens are not configured" }, { status: 500 });
  }
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
