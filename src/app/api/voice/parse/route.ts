import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { parseVoiceTranscriptToTasks } from "@/features/voice/parser";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    const body = await req.json();
    const { transcript, referenceDate } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcription manquante ou invalide" },
        { status: 400 }
      );
    }

    const refDateStr = referenceDate || format(new Date(), "yyyy-MM-dd");

    // 1. Fast local zero-latency parser
    const parsedTasks = parseVoiceTranscriptToTasks(transcript, refDateStr);

    if (parsedTasks.length > 0) {
      return NextResponse.json({
        success: true,
        tasks: parsedTasks,
        source: "hybrid-fast",
      });
    }

    // 2. LLM Fallback if available and local parser returned empty
    const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      const model = process.env.AI_MODEL || "openai/gpt-oss-120b";
      const prompt = `Tu es un assistant qui extrait des tâches, habitudes et projets depuis une transcription vocale en français.
Date de référence: ${refDateStr}.
Transcription vocale: "${transcript}".

Réponds UNIQUEMENT avec un tableau JSON valide d'objets suivant cette structure TypeScript:
[
  {
    "title": "Nom de la tâche",
    "category": "Sport" | "Santé" | "Travail" | "Apprentissage" | "General",
    "recurrence": "ONCE" | "DAILY" | "WEEKDAYS" | "WEEKLY",
    "recurrenceConfig": { "days": [0..6] }, // si WEEKLY (0: Dimanche, 1: Lundi, ...)
    "startTime": "HH:MM" | null,
    "endTime": "HH:MM" | null,
    "targetDate": "YYYY-MM-DD", // si ONCE
    "projectName": "Nom du projet" | null, // si l'utilisateur a spécifié un projet
    "isNewProject": true | false
  }
]`;

      try {
        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        });

        const aiData = await aiRes.json();
        const rawContent = aiData.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
          if (tasks.length > 0) {
            return NextResponse.json({
              success: true,
              tasks,
              source: "hybrid-llm",
            });
          }
        }
      } catch (e) {
        console.error("Voice parse LLM fallback error:", e);
      }
    }

    // Default fallback: 1 basic task with raw transcript
    return NextResponse.json({
      success: true,
      tasks: [
        {
          title: transcript.trim(),
          category: "General",
          trackingType: "BOOLEAN",
          recurrence: "ONCE",
        },
      ],
      source: "fallback",
    });
  } catch (error) {
    console.error("Error in /api/voice/parse:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse vocale" },
      { status: 500 }
    );
  }
}
