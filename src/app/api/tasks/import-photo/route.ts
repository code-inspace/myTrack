import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId, unauthorizedResponse } from "@/lib/supabase/serverAuth";
import { format } from "date-fns";

export interface ExtractedPhotoTask {
  title: string;
  description?: string;
  category?: "Sport" | "Santé" | "Travail" | "Apprentissage" | "General";
  startTime?: string | null;
  endTime?: string | null;
  targetDate?: string;
  isCompleted?: boolean;
  priority?: "low" | "medium" | "high";
}

/** Groq vision model (the former llama-3.2-11b-vision-preview has been decommissioned by Groq). */
const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

/** Parses the model's JSON answer, tolerating ```json fences or text around the object. */
function parseTasksFromContent(content: string): ExtractedPhotoTask[] {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[[{]/);
  const parsed = JSON.parse(start >= 0 ? cleaned.slice(start) : cleaned);
  return Array.isArray(parsed) ? parsed : parsed.tasks || [];
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) return unauthorizedResponse();
    const body = await req.json();
    const { image, referenceDate } = body as {
      image: string;
      referenceDate?: string;
    };

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Image manquante ou format non supporté" },
        { status: 400 }
      );
    }

    const refDateStr = referenceDate || format(new Date(), "yyyy-MM-dd");

    // Standardize data URI
    const dataUri = image.startsWith("data:")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const apiKey =
      process.env.AI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY;

    const systemPrompt = `Tu es un assistant expert en OCR et extraction de listes de tâches manuscrites ou imprimées sur papier en français.
Date de référence du jour: ${refDateStr}.

Analyse attentivement cette photo de liste de tâches sur papier (post-it, carnet, feuille de papier, to-do list).
Extrais chaque tâche ou habitude visible.

Pour chaque élément identifié:
1. "title": Le titre clair et propre de la tâche (corrige les éventuelles petites coquilles manuscrites, majuscule au début).
2. "category": Une catégorie parmi ["Sport", "Santé", "Travail", "Apprentissage", "General"].
3. "startTime": L'heure de début au format "HH:MM" si mentionnée (ex: "14h", "10:30"), sinon null.
4. "endTime": L'heure de fin au format "HH:MM" si mentionnée, sinon null.
5. "targetDate": "${refDateStr}".
6. "isCompleted": true si la case à cocher est déjà cochée / barrée sur le papier, false sinon.

Réponds UNIQUEMENT avec un objet JSON valide sous cette forme exacte:
{
  "tasks": [
    {
      "title": "Acheter du pain",
      "category": "General",
      "startTime": null,
      "endTime": null,
      "targetDate": "${refDateStr}",
      "isCompleted": false
    }
  ]
}`;

    // Real provider failures are reported instead of a generic message
    const providerErrors: string[] = [];

    // 1. Try Groq Vision
    if (process.env.GROQ_API_KEY || (process.env.AI_API_KEY && process.env.AI_API_KEY.startsWith("gsk_"))) {
      const groqKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: process.env.AI_VISION_MODEL || DEFAULT_GROQ_VISION_MODEL,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: systemPrompt },
                  { type: "image_url", image_url: { url: dataUri } },
                ],
              },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        const groqData = await groqRes.json();
        const content = groqData.choices?.[0]?.message?.content;
        if (!groqRes.ok || !content) {
          providerErrors.push(`Groq : ${groqData.error?.message || `HTTP ${groqRes.status}`}`);
        }
        if (content) {
          const tasks = parseTasksFromContent(content);

          if (tasks.length > 0) {
            return NextResponse.json({
              success: true,
              tasks,
              provider: "groq-vision",
            });
          }
        }
      } catch (err) {
        console.warn("[import-photo] Groq Vision attempt error:", err);
        providerErrors.push(`Groq : ${(err as Error)?.message || "réponse illisible"}`);
      }
    }

    // 2. Try OpenAI Vision (GPT-4o / GPT-4o-mini)
    if (process.env.OPENAI_API_KEY || (apiKey && apiKey.startsWith("sk-"))) {
      const openAiKey = process.env.OPENAI_API_KEY || apiKey;
      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: systemPrompt },
                  { type: "image_url", image_url: { url: dataUri } },
                ],
              },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        const oaiData = await oaiRes.json();
        const content = oaiData.choices?.[0]?.message?.content;
        if (!oaiRes.ok || !content) {
          providerErrors.push(`OpenAI : ${oaiData.error?.message || `HTTP ${oaiRes.status}`}`);
        }
        if (content) {
          const tasks = parseTasksFromContent(content);

          if (tasks.length > 0) {
            return NextResponse.json({
              success: true,
              tasks,
              provider: "openai-vision",
            });
          }
        }
      } catch (err) {
        console.warn("[import-photo] OpenAI Vision attempt error:", err);
        providerErrors.push(`OpenAI : ${(err as Error)?.message || "réponse illisible"}`);
      }
    }

    // 3. No key configured, or the provider failed (its message is shown), or nothing was read
    if (providerErrors.length > 0) {
      console.error("[import-photo] Vision providers failed:", providerErrors);
      return NextResponse.json({
        success: false,
        error: `L'analyse IA a échoué (${providerErrors.join(" · ")}).`,
        tasks: [],
      });
    }
    const hasVisionKey = Boolean(
      process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || (apiKey && /^(gsk_|sk-)/.test(apiKey)),
    );
    // An empty list is a valid answer: the modal then explains that nothing was detected
    return NextResponse.json(
      hasVisionKey
        ? { success: true, tasks: [] }
        : {
            success: false,
            error: "Aucun modèle de vision configuré : ajoute GROQ_API_KEY ou OPENAI_API_KEY.",
            tasks: [],
          },
    );
  } catch (error: any) {
    console.error("Error in /api/tasks/import-photo:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'analyse de l'image" },
      { status: 500 }
    );
  }
}
