/**
 * Automatic Groq model selection — no model name in the code or in env vars.
 *
 * The models available to the Groq key (free tier: free within rate limits) are listed from the
 * Groq API with their capabilities, ranked, then tried one after another until one answers. The
 * model that worked is remembered so the next calls go straight to it; a retired model, one that
 * can't read images or one that hit its (per-model) rate limit just moves on to the next.
 */

const GROQ_API = "https://api.groq.com/openai/v1";
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 6;
/** Used only if the model list itself can't be fetched. */
const FALLBACK_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

export type GroqModelKind = "chat" | "vision";

interface GroqModelInfo {
  id: string;
  active?: boolean;
  context_window?: number;
  input_modalities?: string[];
  output_modalities?: string[];
}

let modelsCache: { at: number; models: GroqModelInfo[] } | null = null;
const workingModel: Partial<Record<GroqModelKind, string>> = {};

async function listGroqModels(apiKey: string): Promise<GroqModelInfo[] | null> {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_CACHE_TTL_MS) return modelsCache.models;
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const models: GroqModelInfo[] = Array.isArray(data?.data) ? data.data : [];
    modelsCache = { at: Date.now(), models };
    return models;
  } catch {
    return null;
  }
}

/** "openai/gpt-oss-120b" → 120, "qwen/qwen3.8-27b" → 27 (billions of parameters), else 0. */
function parameterSize(id: string): number {
  const match = id.toLowerCase().match(/(\d+(?:\.\d+)?)b(?![a-z])/g);
  if (!match) return 0;
  return Math.max(...match.map((m) => parseFloat(m)));
}

/** Text-in/text-out general models (vision: also image-in), biggest first. */
export function rankGroqModels(models: GroqModelInfo[], kind: GroqModelKind): string[] {
  return models
    .filter((m) => m.active !== false)
    .filter((m) => (m.output_modalities || ["text"]).includes("text") && (m.output_modalities || ["text"]).length === 1)
    .filter((m) => (m.input_modalities || ["text"]).includes(kind === "vision" ? "image" : "text"))
    .filter((m) => (m.context_window ?? 8192) >= 8192)
    // classifiers / moderation models answer with labels, not content
    .filter((m) => !/guard|safeguard|whisper|tts|orpheus/i.test(m.id))
    .sort(
      (a, b) =>
        parameterSize(b.id) - parameterSize(a.id) || (b.context_window ?? 0) - (a.context_window ?? 0),
    )
    .map((m) => m.id);
}

async function getCandidates(apiKey: string, kind: GroqModelKind): Promise<string[]> {
  const models = await listGroqModels(apiKey);
  const ranked = models ? rankGroqModels(models, kind) : FALLBACK_MODELS;
  const remembered = workingModel[kind];
  return remembered && ranked.includes(remembered)
    ? [remembered, ...ranked.filter((id) => id !== remembered)]
    : ranked;
}

export interface GroqChatResult {
  content: string;
  model: string;
}

/**
 * Sends a chat completion to the best available Groq model, moving on to the next one when a
 * model is unusable. Throws with every model's error if none answered.
 */
export async function groqChatCompletion(
  apiKey: string,
  kind: GroqModelKind,
  body: Record<string, unknown>,
): Promise<GroqChatResult> {
  const candidates = (await getCandidates(apiKey, kind)).slice(0, MAX_ATTEMPTS);
  if (candidates.length === 0) {
    throw new Error(kind === "vision" ? "aucun modèle Groq ne lit les images" : "aucun modèle Groq disponible");
  }

  const errors: string[] = [];
  for (const model of candidates) {
    try {
      const res = await fetch(`${GROQ_API}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ ...body, model }),
      });
      const data = await res.json().catch(() => ({}));
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (res.ok && content) {
        workingModel[kind] = model;
        return { content, model };
      }
      // A bad key won't work with any other model
      if (res.status === 401 || res.status === 403) {
        throw new Error(data?.error?.message || "clé Groq refusée");
      }
      errors.push(`${model}: ${data?.error?.message || `HTTP ${res.status}`}`);
      if (workingModel[kind] === model) delete workingModel[kind];
    } catch (err) {
      if ((err as Error).message && /clé|key|auth/i.test((err as Error).message)) throw err;
      errors.push(`${model}: ${(err as Error).message}`);
    }
  }
  throw new Error(errors.join(" · "));
}
