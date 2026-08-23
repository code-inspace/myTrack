import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { AICoachContext } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, context } = body as {
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      context: AICoachContext;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const provider = getAIProvider();
    const response = await provider.generateResponse({
      messages,
      context,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("API /api/chat error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI response" },
      { status: 500 }
    );
  }
}
