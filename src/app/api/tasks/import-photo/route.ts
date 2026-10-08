import { NextRequest, NextResponse } from "next/server";
import { groqChatCompletion } from "@/lib/ai/groqModels";
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

    // Free Groq key only (the paid OpenAI API is never used)
    const apiKey =
      process.env.GROQ_API_KEY || (process.env.AI_API_KEY?.startsWith("gsk_") ? process.env.AI_API_KEY : undefined);
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "Aucune clé Groq configurée : ajoute GROQ_API_KEY.",
        tasks: [],
      });
    }

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

    // The vision model is picked automatically among the Groq models that read images
    try {
      const { content, model } = await groqChatCompletion(apiKey, "vision", {
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
      });
      // An empty list is a valid answer: the modal then explains that nothing was detected
      return NextResponse.json({ success: true, tasks: parseTasksFromContent(content), provider: model });
    } catch (err) {
      console.error("[import-photo] Groq vision failed:", err);
      return NextResponse.json({
        success: false,
        error: `L'analyse IA a échoué (${(err as Error).message}).`,
        tasks: [],
      });
    }
  } catch (error: any) {
    console.error("Error in /api/tasks/import-photo:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'analyse de l'image" },
      { status: 500 }
    );
  }
}
