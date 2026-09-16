import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[API Widget Sleep Action] Received background sleep action:", body);

    // action can be: "BEDTIME_NOW" or "WAKE_NOW"
    // payload includes: { action, time, timestamp, phaseIndex, bedtime? }

    return NextResponse.json({
      success: true,
      action: body.action,
      time: body.time,
      phaseIndex: body.phaseIndex,
      receivedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API Widget Sleep Action Error]:", error);
    return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 400 });
  }
}
